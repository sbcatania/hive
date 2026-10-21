"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GameView } from "@/components/GameView";
import { engineFromMoves, errorMessage, loadEngine } from "@/lib/engine";
import { colorName, resultText, type ColorCode, type StateView } from "@/lib/engine-types";
import {
  answerTakeback,
  claimTimeout,
  createRematch,
  declineDraw,
  fetchGame,
  joinGame,
  offerDraw,
  playMove,
  requestTakeback,
  resign,
  rulesFromRow,
  serverOffset,
  subscribeGame,
  type OnlineGame,
  type Seat,
} from "@/lib/online";
import { loadTheme, saveTheme, type ThemeId } from "@/lib/themes";

function fmtClock(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

const REASONS: Record<string, string> = {
  surround: "Queen surrounded",
  resignation: "by resignation",
  agreement: "by agreement",
  time: "on time",
};

function OnlineGameView() {
  const params = useSearchParams();
  const router = useRouter();
  const id = params.get("g") ?? "";
  const [row, setRow] = useState<OnlineGame | null>(null);
  const [seat, setSeat] = useState<Seat | null>(null);
  const [engineReady, setEngineReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [theme, setTheme] = useState<ThemeId>("flat");
  const [connected, setConnected] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [copied, setCopied] = useState(false);
  const offset = useRef(0);
  const timeoutClaimed = useRef<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const g = await fetchGame(id);
      if (!g) setError("Game not found. Check the link.");
      else setRow((cur) => (cur && cur.updated_at > g.updated_at ? cur : g));
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [id]);

  useEffect(() => {
    setTheme(loadTheme());
    if (!id) {
      setError("Missing game id.");
      return;
    }
    let unsub: (() => void) | null = null;
    (async () => {
      try {
        await loadEngine();
        setEngineReady(true);
        setSeat(await joinGame(id));
        await reload();
        offset.current = await serverOffset().catch(() => 0);
        unsub = subscribeGame(id, (g) => setRow(g), setConnected);
      } catch (e) {
        setError(errorMessage(e));
      }
    })();
    const onFocus = () => reload();
    window.addEventListener("focus", onFocus);
    return () => {
      unsub?.();
      window.removeEventListener("focus", onFocus);
    };
  }, [id, reload]);

  // Poll as a fallback while realtime isn't connected.
  useEffect(() => {
    if (connected) return;
    const t = setInterval(reload, 4000);
    return () => clearInterval(t);
  }, [connected, reload]);

  // Clock tick.
  useEffect(() => {
    if (!row?.base_ms || row.status !== "active") return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [row?.base_ms, row?.status]);

  const game = useMemo(() => {
    if (!row || !engineReady) return null;
    try {
      const e = engineFromMoves(rulesFromRow(row), row.moves);
      if (row.result) e.setResult(row.result);
      const s = e.state();
      e.free();
      return { state: s, error: null as string | null };
    } catch (err) {
      return { state: null, error: "This game contains an illegal move: " + errorMessage(err) };
    }
  }, [row, engineReady]);

  const state: StateView | null = game?.state ?? null;
  const toMove: ColorCode = (row?.moves.length ?? 0) % 2 === 0 ? "w" : "b";

  const clocks = useMemo(() => {
    if (!row?.base_ms) return null;
    const elapsed = row.status === "active" && row.turn_started_at ? now + offset.current - new Date(row.turn_started_at).getTime() : 0;
    return {
      w: (row.white_ms ?? 0) - (toMove === "w" ? elapsed : 0),
      b: (row.black_ms ?? 0) - (toMove === "b" ? elapsed : 0),
    };
  }, [row, now, toMove]);

  // Flag fall: either client may ask the server to end the game.
  useEffect(() => {
    if (!clocks || !row || row.status !== "active") return;
    const key = `${row.id}:${row.moves.length}`;
    if (clocks[toMove] <= 0 && timeoutClaimed.current !== key) {
      timeoutClaimed.current = key;
      claimTimeout(row.id).then(reload).catch(() => {});
    }
  }, [clocks, row, toMove, reload]);

  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await reload();
    } catch (e) {
      setError(errorMessage(e));
      await reload();
    } finally {
      setBusy(false);
    }
  }

  function play(notation: string) {
    if (!row || !state) return;
    let result: string | null = null;
    try {
      const e = engineFromMoves(rulesFromRow(row), row.moves);
      const normalised = e.play(notation);
      const s = e.state();
      e.free();
      if (s.status === "WhiteWins" || s.status === "BlackWins" || s.status === "Draw") result = s.status;
      // Optimistic update so the move appears immediately.
      setRow({ ...row, moves: [...row.moves, normalised], draw_offer: row.draw_offer === seat ? row.draw_offer : null, takeback_request: null });
      act(() => playMove(row.id, row.moves.length, normalised, result));
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  if (error && !row) {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <p className="mb-4 text-red-600">{error}</p>
        <Link className="btn" href="/">
          Back to start
        </Link>
      </div>
    );
  }
  if (!row || !state || !seat) {
    return <div className="p-8 text-center text-[var(--muted)]">{game?.error ?? "Connecting to game…"}</div>;
  }

  const playing = seat !== "spectator";
  const opp: ColorCode | null = seat === "w" ? "b" : seat === "b" ? "w" : null;
  const canMove = playing && row.status === "active" && toMove === seat && !busy;
  const link = typeof window !== "undefined" ? `${window.location.origin}/online?g=${row.id}` : "";

  const labelFor = (c: ColorCode) => {
    const joined = c === "w" ? row.white_joined : row.black_joined;
    const who = seat === c ? "You" : playing ? "Opponent" : colorName(c);
    return `${who}${playing ? ` (${colorName(c)})` : ""}${joined ? "" : " · waiting to join"}`;
  };
  const clockNode = (c: ColorCode) =>
    clocks ? (
      <span
        className={`rounded-md px-2 py-0.5 font-mono text-sm tabular-nums ${row.status === "active" && toMove === c ? (clocks[c] < 20_000 ? "bg-red-600 text-white" : "bg-neutral-800 text-white") : "bg-black/5 dark:bg-white/10"}`}
      >
        {fmtClock(clocks[c])}
      </span>
    ) : null;

  const status =
    row.status === "waiting"
      ? "Waiting for an opponent to join"
      : row.status === "finished"
        ? `${resultText(row.result!)} ${REASONS[row.result_reason ?? ""] ?? ""}`
        : canMove
          ? state.mustPass
            ? "You have no legal moves — pass"
            : "Your move"
          : `${colorName(toMove)} to move`;

  const youWon = row.result && ((row.result === "WhiteWins" && seat === "w") || (row.result === "BlackWins" && seat === "b"));

  const sidebar = (
    <div className="space-y-3">
      {error && <div className="rounded-lg bg-red-50 p-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</div>}
      {game?.error && <div className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{game.error}</div>}

      {row.status === "waiting" && playing && (
        <div className="card space-y-2 text-sm">
          <div className="font-semibold">Invite a friend</div>
          <p className="text-[var(--muted)]">Send this link. The first person to open it plays {colorName(opp!)}; anyone after that can watch.</p>
          <div className="flex gap-2">
            <input readOnly value={link} className="min-w-0 flex-1 rounded-md border border-[var(--line)] bg-[var(--bg)] px-2 py-1 font-mono text-xs" onFocus={(e) => e.target.select()} />
            <button
              className="btn shrink-0"
              onClick={async () => {
                await navigator.clipboard.writeText(link);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}

      {!playing && <div className="rounded-lg bg-blue-50 p-2 text-sm text-blue-800 dark:bg-blue-950/40 dark:text-blue-200">You&apos;re watching this game.</div>}

      {row.status === "finished" && (
        <div className="card text-center">
          <div className="text-lg font-bold">{playing ? (row.result === "Draw" ? "Draw" : youWon ? "You win! 🎉" : "You lost") : resultText(row.result!)}</div>
          <div className="text-xs text-[var(--muted)]">{REASONS[row.result_reason ?? ""] ?? ""}</div>
          {playing && (
            <div className="mt-3 flex justify-center gap-2">
              {row.rematch_id ? (
                <button className="btn" onClick={() => router.push(`/online?g=${row.rematch_id}`)}>
                  Join rematch
                </button>
              ) : (
                <button className="btn" disabled={busy} onClick={() => act(async () => router.push(`/online?g=${await createRematch(row.id)}`))}>
                  Rematch (swap colours)
                </button>
              )}
              <Link className="btn-secondary" href="/">
                New game
              </Link>
            </div>
          )}
        </div>
      )}

      {row.status === "active" && playing && row.draw_offer === opp && (
        <div className="card space-y-2 text-sm">
          <div>Your opponent offers a draw.</div>
          <div className="flex gap-2">
            <button className="btn flex-1" disabled={busy} onClick={() => act(() => offerDraw(row.id))}>
              Accept
            </button>
            <button className="btn-secondary flex-1" disabled={busy} onClick={() => act(() => declineDraw(row.id))}>
              Decline
            </button>
          </div>
        </div>
      )}
      {row.status === "active" && playing && row.takeback_request === opp && (
        <div className="card space-y-2 text-sm">
          <div>Your opponent asks to take back their last move.</div>
          <div className="flex gap-2">
            <button className="btn flex-1" disabled={busy} onClick={() => act(() => answerTakeback(row.id, true))}>
              Allow
            </button>
            <button className="btn-secondary flex-1" disabled={busy} onClick={() => act(() => answerTakeback(row.id, false))}>
              Decline
            </button>
          </div>
        </div>
      )}

      {canMove && state.mustPass && (
        <button className="btn w-full" onClick={() => play("pass")}>
          Pass (no legal moves)
        </button>
      )}

      {row.status === "active" && playing && (
        <div className="grid grid-cols-2 gap-2">
          <button
            className="btn-secondary"
            disabled={busy || row.takeback_request === seat || row.moves.length < (seat === "w" ? 1 : 2)}
            onClick={() => act(() => requestTakeback(row.id))}
          >
            {row.takeback_request === seat ? "Takeback asked…" : "↶ Ask takeback"}
          </button>
          <button className="btn-secondary" disabled={busy || row.draw_offer === seat} onClick={() => act(() => offerDraw(row.id))}>
            {row.draw_offer === seat ? "Draw offered…" : "½ Offer draw"}
          </button>
          <button
            className="btn-secondary col-span-2"
            disabled={busy}
            onClick={() => {
              if (confirm("Resign this game?")) act(() => resign(row.id));
            }}
          >
            🏳 Resign
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
        <span className={`inline-block h-2 w-2 rounded-full ${connected ? "bg-green-500" : "bg-amber-500"}`} />
        {connected ? "Live" : "Reconnecting (polling)"} · game <span className="font-mono">{row.id}</span>
        {row.base_ms ? ` · ${row.base_ms / 60000} min + ${row.increment_ms / 1000}s` : " · untimed"}
        {playing && row.status !== "waiting" && (
          <button
            className="btn-ghost"
            onClick={async () => {
              await navigator.clipboard.writeText(`${window.location.origin}/online?g=${row.id}`);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? "Copied" : "Copy spectator link"}
          </button>
        )}
      </div>
    </div>
  );

  return (
    <GameView
      state={state}
      theme={theme}
      onThemeChange={(t) => {
        setTheme(t);
        saveTheme(t);
      }}
      canMove={canMove}
      onPlay={play}
      labels={{ w: labelFor("w"), b: labelFor("b") }}
      clocks={clocks ? { w: clockNode("w"), b: clockNode("b") } : undefined}
      bottom={seat === "b" ? "b" : "w"}
      status={status}
      sidebar={sidebar}
    />
  );
}

export default function OnlinePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-[var(--muted)]">Loading…</div>}>
      <OnlineGameView />
    </Suspense>
  );
}
