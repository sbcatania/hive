"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ClockFace, GameOverCard, NewGameLink } from "@/components/GameBits";
import { Icon } from "@/components/Icon";
import { GameView, type GameAction, type PlayerInfo } from "@/components/GameView";
import { useAuth } from "@/lib/auth";
import { engineFromMoves, errorMessage, loadEngine, withEngine } from "@/lib/engine";
import { colorName, resultText, type ColorCode, type StateView } from "@/lib/engine-types";
import { REASON_TEXT, resultSentence } from "@/lib/journal";
import {
  answerTakeback,
  claimTimeout,
  createRematch,
  declineDraw,
  fetchGame,
  fetchPlayers,
  joinGame,
  offerDraw,
  playMove,
  requestTakeback,
  resign,
  rulesFromRow,
  serverOffset,
  subscribeGame,
  type OnlineGame,
  type PlayerSummary,
  type Seat,
} from "@/lib/online";
import { loadTheme, saveTheme, type ThemeId } from "@/lib/themes";
import { describeVariants, expansionLabel } from "@/lib/variants";
import { useDialogs } from "@/components/Dialogs";

function OnlineGameView() {
  const params = useSearchParams();
  const router = useRouter();
  const { user, loading: authLoading, refreshProfile } = useAuth();
  const dialogs = useDialogs();
  const id = params.get("g") ?? "";
  const [row, setRow] = useState<OnlineGame | null>(null);
  const [seat, setSeat] = useState<Seat | null>(null);
  const [players, setPlayers] = useState<Record<string, PlayerSummary>>({});
  const [engineReady, setEngineReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [theme, setTheme] = useState<ThemeId>("field");
  const [connected, setConnected] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [copied, setCopied] = useState<string | null>(null);
  const [overlayClosed, setOverlayClosed] = useState(false);
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

  // Join once auth has settled, so a signed-in player's seat is linked to their account.
  useEffect(() => {
    setTheme(loadTheme());
    if (!id) {
      setError("Missing game id.");
      return;
    }
    if (authLoading) return;
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
  }, [id, reload, authLoading, user?.id]);

  useEffect(() => {
    if (connected) return;
    const t = setInterval(reload, 4000);
    return () => clearInterval(t);
  }, [connected, reload]);

  useEffect(() => {
    if (!row?.base_ms || row.status !== "active") return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [row?.base_ms, row?.status]);

  // Player names and ratings.
  useEffect(() => {
    if (!row) return;
    const ids = [row.white_player, row.black_player];
    if (ids.every((x) => !x || players[x])) return;
    fetchPlayers(ids).then((p) => setPlayers((cur) => ({ ...cur, ...p })));
  }, [row, players]);

  // Refresh my rating when a rated game ends.
  useEffect(() => {
    if (row?.status === "finished" && row.rated) {
      refreshProfile();
      setOverlayClosed(false);
      fetchPlayers([row.white_player, row.black_player]).then((p) => setPlayers((cur) => ({ ...cur, ...p })));
    }
  }, [row?.status, row?.rated]); // eslint-disable-line react-hooks/exhaustive-deps

  const rules = useMemo(() => (row ? rulesFromRow(row) : null), [row]);

  const game = useMemo(() => {
    if (!row || !engineReady || !rules) return null;
    try {
      const e = engineFromMoves(rules, row.moves);
      if (row.result) e.setResult(row.result);
      const s = e.state();
      e.free();
      return { state: s, error: null as string | null };
    } catch (err) {
      return { state: null, error: "This game contains an illegal move: " + errorMessage(err) };
    }
  }, [row, engineReady, rules]);

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

  useEffect(() => {
    if (!clocks || !row || row.status !== "active") return;
    const key = `${row.id}:${row.moves.length}`;
    if (clocks[toMove] <= 0 && timeoutClaimed.current !== key) {
      timeoutClaimed.current = key;
      claimTimeout(row.id).then(reload).catch(() => {});
    }
  }, [clocks, row, toMove, reload]);

  const getPreview = useCallback((piece: string) => withEngine(rules!, row!.moves, (e) => e.preview(piece)), [rules, row]);

  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      await reload();
      setBusy(false);
    }
  }

  function play(notation: string) {
    if (!row || !state || !rules) return;
    try {
      const { normalised, result } = withEngine(rules, row.moves, (e) => {
        const n = e.play(notation);
        const s = e.state();
        return { normalised: n, result: s.status === "WhiteWins" || s.status === "BlackWins" || s.status === "Draw" ? s.status : null, reason: s.endReason };
      });
      setRow({ ...row, moves: [...row.moves, normalised], draw_offer: row.draw_offer === seat ? row.draw_offer : null, takeback_request: null });
      const reason = result ? (withEngine(rules, [...row.moves, normalised], (e) => e.state().endReason) ?? "surround") : undefined;
      act(() => playMove(row.id, row.moves.length, normalised, result, reason));
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function copy(text: string, what: string) {
    await navigator.clipboard.writeText(text);
    setCopied(what);
    setTimeout(() => setCopied(null), 1500);
  }

  if (error && !row) {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <p className="note-error mb-4">{error}</p>
        <Link className="btn" href="/">
          Back to start
        </Link>
      </div>
    );
  }
  if (!row || !state || !seat || !rules) {
    return <div className="grid h-[60vh] place-items-center text-muted">{game?.error ?? "Finding the game…"}</div>;
  }

  const playing = seat === "w" || seat === "b";
  const opp: ColorCode | null = seat === "w" ? "b" : seat === "b" ? "w" : null;
  const canMove = playing && row.status === "active" && toMove === seat && !busy;
  const link = typeof window !== "undefined" ? `${window.location.origin}/online?g=${row.id}` : "";

  const info = (c: ColorCode): PlayerInfo => {
    const pid = c === "w" ? row.white_player : row.black_player;
    const prof = pid ? players[pid] : null;
    const joined = c === "w" ? row.white_joined : row.black_joined;
    const you = seat === c;
    const name = prof?.username ?? (you ? "You" : playing ? "Opponent" : colorName(c));
    const parts = [you && prof ? "You" : null, colorName(c), prof && prof.rated_games > 0 ? `${prof.rating}` : prof ? "unrated" : "guest"].filter(Boolean);
    return {
      name,
      sub: joined ? parts.join(", ") : "waiting to join…",
      clock: clocks ? <ClockFace ms={clocks[c]} running={row.status === "active" && toMove === c} /> : undefined,
    };
  };

  const status =
    row.status === "waiting"
      ? "Waiting for an opponent to join"
      : row.status === "finished"
        ? resultSentence(row.result!, row.result_reason)
        : canMove
          ? state.mustPass
            ? "You have no legal move: pass"
            : "Your move"
          : `${colorName(toMove)} to move`;

  const youWon = row.result && ((row.result === "WhiteWins" && seat === "w") || (row.result === "BlackWins" && seat === "b"));
  const myDelta = seat === "w" ? row.white_delta : seat === "b" ? row.black_delta : null;
  const variants = describeVariants(rules);

  const overlay =
    row.status === "finished" && !overlayClosed ? (
      <GameOverCard
        tone={!playing ? "neutral" : row.result === "Draw" ? "draw" : youWon ? "win" : "loss"}
        title={!playing ? resultText(row.result!) : row.result === "Draw" ? "A draw" : youWon ? "You win!" : "You lost"}
        subtitle={REASON_TEXT[row.result_reason ?? ""]}
        detail={
          row.rated && row.white_delta !== null ? (
            <span>
              Rated game ·{" "}
              {myDelta !== null ? (
                <b className={myDelta >= 0 ? "text-move" : "text-danger"}>
                  {myDelta >= 0 ? "+" : ""}
                  {myDelta} Elo
                </b>
              ) : (
                `White ${row.white_delta >= 0 ? "+" : ""}${row.white_delta}, Black ${row.black_delta! >= 0 ? "+" : ""}${row.black_delta}`
              )}
            </span>
          ) : row.rated ? (
            "Rated game (too short to count)"
          ) : (
            `${row.moves.length} moves`
          )
        }
        onClose={() => setOverlayClosed(true)}
        actions={
          <>
            {playing &&
              (row.rematch_id ? (
                <button className="btn" onClick={() => router.push(`/online?g=${row.rematch_id}`)}>
                  Join rematch
                </button>
              ) : (
                <button className="btn" disabled={busy} onClick={() => act(async () => router.push(`/online?g=${await createRematch(row.id)}`))}>
                  Rematch
                </button>
              ))}
            <Link className="btn-secondary" href={`/replay?online=${row.id}`}>
              Review game
            </Link>
            <NewGameLink />
          </>
        }
      />
    ) : null;

  const notice = (
    <div className="space-y-2">
      {error && <div className="note-error">{error}</div>}
      {game?.error && <div className="note-error">{game.error}</div>}

      {seat === "login_required" && (
        <div className="note-warn">
          This is a rated game: <Link href={`/account?next=/online?g=${row.id}`} className="font-semibold underline">sign in</Link> to take the open seat. You can watch in the meantime.
        </div>
      )}
      {seat === "same_account" && <div className="note-warn">You created this rated game, so you can&apos;t take the other seat. Send the link to a friend.</div>}

      {row.status === "waiting" && playing && (
        <div className="card space-y-2 !p-3 text-sm">
          <div className="font-semibold">Invite a friend</div>
          <p className="hidden text-muted lg:block">
            The first person to open this link plays {colorName(opp!)}
            {row.rated ? " (they'll need an account)" : ""}. Anyone after that can watch.
          </p>
          <div className="flex gap-2">
            <input readOnly value={link} className="input min-w-0 flex-1 font-mono text-xs" onFocus={(e) => e.target.select()} />
            <button className="btn shrink-0" onClick={() => copy(link, "invite")}>
              <Icon name={copied === "invite" ? "check" : "copy"} size={17} />
              {copied === "invite" ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}

      {row.status === "active" && playing && row.draw_offer === opp && (
        <div className="note-warn space-y-2">
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
        <div className="note-warn space-y-2">
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

    </div>
  );

  const sidebar = (
    <div className="space-y-3">
      <div className="card !p-3 text-sm">
        <div className="flex items-center justify-between">
          <div className="font-display text-lg font-semibold">{row.rated ? "Rated game" : "Friendly game"}</div>
          <span className="flex items-center gap-1.5 text-xs text-muted">
            <span className={`inline-block h-2 w-2 rounded-full ${connected ? "bg-move" : "bg-accent"}`} />
            {connected ? "Live" : "Reconnecting"}
          </span>
        </div>
        <div className="text-xs text-muted">
          {expansionLabel(rules)}
          {variants.length ? `, ${variants.join(", ")}` : ""}. {row.base_ms ? `${row.base_ms / 60000} min + ${row.increment_ms / 1000}s` : "untimed"} · game <span className="font-mono">{row.id}</span>
        </div>
      </div>

      {!playing && seat === "spectator" && <div className="note-info">You&apos;re watching this game.</div>}

      {canMove && state.mustPass && (
        <button className="btn w-full" onClick={() => play("pass")}>
          Pass (no legal moves)
        </button>
      )}

      <div className="flex flex-wrap gap-2">
        {playing && row.status !== "waiting" && (
          <button className="btn-ghost" onClick={() => copy(link, "spectate")}>
            <Icon name={copied === "spectate" ? "check" : "eye"} size={16} />
            {copied === "spectate" ? "Copied" : "Copy spectator link"}
          </button>
        )}
        {row.status === "finished" && (
          <button className="btn-ghost" onClick={() => setOverlayClosed(false)}>
            <Icon name="eye" size={16} />
            Show result
          </button>
        )}
      </div>
      {!user && playing && !row.rated && (
        <p className="text-xs text-muted">
          Playing as a guest. <Link href="/account" className="underline">Create an account</Link> to keep your online games and play rated.
        </p>
      )}
    </div>
  );

  const active = row.status === "active" && playing;
  const actions: GameAction[] = active
    ? [
        {
          id: "takeback",
          icon: "undo",
          label: row.takeback_request === seat ? "Asked…" : "Ask takeback",
          short: "Takeback",
          onClick: () => act(() => requestTakeback(row.id)),
          disabled: busy || row.takeback_request === seat || row.moves.length < (seat === "w" ? 1 : 2),
          active: row.takeback_request === seat,
        },
        { id: "draw", icon: "draw", label: row.draw_offer === seat ? "Draw offered…" : "Offer draw", short: "Draw", onClick: () => act(() => offerDraw(row.id)), disabled: busy || row.draw_offer === seat, active: row.draw_offer === seat, menu: true },
        { id: "share", icon: "share", label: copied === "spectate" ? "Copied" : "Spectator link", short: "Share", onClick: () => copy(link, "spectate") },
        { id: "resign", icon: "flag", label: "Resign", onClick: async () => (await dialogs.confirm({ title: "Resign this game?", message: row.rated ? "It counts as a loss and changes your rating." : "It counts as a loss.", confirm: "Resign", danger: true })) && act(() => resign(row.id)), disabled: busy, menu: true },
      ]
    : [];

  return (
    <GameView
      actions={actions}
      notice={notice}
      state={state}
      theme={theme}
      onThemeChange={(t) => {
        setTheme(t);
        saveTheme(t);
      }}
      canMove={canMove}
      onPlay={play}
      getPreview={getPreview}
      players={{ w: info("w"), b: info("b") }}
      bottom={seat === "b" ? "b" : "w"}
      status={status}
      sidebar={sidebar}
      overlay={overlay}
    />
  );
}

export default function OnlinePage() {
  return (
    <Suspense fallback={<div className="grid h-[60vh] place-items-center text-muted">Finding the game…</div>}>
      <OnlineGameView />
    </Suspense>
  );
}
