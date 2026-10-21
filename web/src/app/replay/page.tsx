"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EvalBar } from "@/components/EvalBar";
import { GameView, type GameAction, type PlayerInfo } from "@/components/GameView";
import { AiClient } from "@/lib/ai-client";
import { useAuth } from "@/lib/auth";
import { errorMessage, loadEngine, withEngine } from "@/lib/engine";
import { levelInfo, resultText, type AiResult, type ColorCode, type Rules, type StateView } from "@/lib/engine-types";
import { gameTitle, getLocal, listCloud, newId, REASON_TEXT, saveLocal, setCurrentGameId, resultSentence } from "@/lib/journal";
import { fetchGame, fetchPlayers, rulesFromRow } from "@/lib/online";
import { loadTheme, saveTheme, type ThemeId } from "@/lib/themes";
import { describeVariants, expansionLabel } from "@/lib/variants";
import { Icon } from "@/components/Icon";

interface Source {
  title: string;
  rules: Rules;
  moves: string[];
  result?: string | null;
  reason?: string | null;
  players: Record<ColorCode, PlayerInfo>;
}

function Replay() {
  const params = useSearchParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [src, setSrc] = useState<Source | null>(null);
  const [ply, setPly] = useState(0);
  const [theme, setTheme] = useState<ThemeId>("field");
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [evalOn, setEvalOn] = useState(false);
  const [evalResult, setEvalResult] = useState<AiResult | null>(null);
  const [evalLoading, setEvalLoading] = useState(false);
  const ai = useRef<AiClient | null>(null);

  useEffect(() => {
    setTheme(loadTheme());
    if (authLoading) return;
    (async () => {
      try {
        await loadEngine();
        const localId = params.get("local");
        const onlineId = params.get("online");
        if (localId) {
          let e = getLocal(localId);
          if (!e && user) e = (await listCloud()).find((x) => x.id === localId) ?? null;
          if (!e) throw new Error("That game isn't in this journal.");
          const p = e.level ? levelInfo(e.level) : null;
          const pl: Record<ColorCode, PlayerInfo> = { w: { name: "White" }, b: { name: "Black" } };
          if (e.mode === "cpu" && p) {
            pl[e.human] = { name: "You" };
            pl[e.human === "w" ? "b" : "w"] = { name: "Computer", sub: p.name };
          }
          setSrc({ title: gameTitle(e), rules: e.rules, moves: e.moves, result: e.result, reason: e.resultReason, players: pl });
          setPly(e.moves.length);
        } else if (onlineId) {
          const g = await fetchGame(onlineId);
          if (!g) throw new Error("Game not found.");
          const ps = await fetchPlayers([g.white_player, g.black_player]);
          const nm = (id: string | null, c: string) => (id && ps[id] ? ps[id].username : c);
          setSrc({
            title: `${nm(g.white_player, "White")} vs ${nm(g.black_player, "Black")}`,
            rules: rulesFromRow(g),
            moves: g.moves,
            result: g.result,
            reason: g.result_reason,
            players: {
              w: { name: nm(g.white_player, "White"), sub: g.white_rating ? `${g.white_rating}${g.white_delta !== null ? ` (${g.white_delta >= 0 ? "+" : ""}${g.white_delta})` : ""}` : "White" },
              b: { name: nm(g.black_player, "Black"), sub: g.black_rating ? `${g.black_rating}${g.black_delta !== null ? ` (${g.black_delta! >= 0 ? "+" : ""}${g.black_delta})` : ""}` : "Black" },
            },
          });
          setPly(g.moves.length);
        } else throw new Error("Nothing to replay.");
      } catch (e) {
        setError(errorMessage(e));
      }
    })();
  }, [params, user, authLoading]);

  const state: StateView | null = useMemo(() => {
    if (!src) return null;
    return withEngine(src.rules, src.moves.slice(0, ply), (e) => {
      if (ply === src.moves.length && src.result && (src.result === "WhiteWins" || src.result === "BlackWins" || src.result === "Draw")) e.setResult(src.result);
      const s = e.state();
      // Show the full game's notation in the list, not just up to the cursor.
      return { ...s, history: src.moves };
    });
  }, [src, ply]);

  // Autoplay.
  useEffect(() => {
    if (!playing || !src) return;
    if (ply >= src.moves.length) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setPly((p) => p + 1), 900);
    return () => clearTimeout(t);
  }, [playing, ply, src]);

  // Keyboard: ← → Home End.
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (!src) return;
      if (e.key === "ArrowLeft") setPly((p) => Math.max(0, p - 1));
      if (e.key === "ArrowRight") setPly((p) => Math.min(src.moves.length, p + 1));
      if (e.key === "Home") setPly(0);
      if (e.key === "End") setPly(src.moves.length);
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [src]);

  useEffect(() => {
    if (!evalOn || !src) return;
    if (!ai.current) ai.current = new AiClient();
    let alive = true;
    setEvalLoading(true);
    ai.current
      .analyze(src.rules, src.moves.slice(0, ply), 700)
      .then((r) => alive && setEvalResult(r))
      .catch(() => {})
      .finally(() => alive && setEvalLoading(false));
    return () => {
      alive = false;
    };
  }, [evalOn, ply, src]);

  useEffect(() => () => ai.current?.terminate(), []);

  const getPreview = useCallback((piece: string) => withEngine(src!.rules, src!.moves.slice(0, ply), (e) => e.preview(piece)), [src, ply]);

  if (error) {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <p className="note-error mb-4">{error}</p>
        <Link className="btn" href="/journal">
          Back to the journal
        </Link>
      </div>
    );
  }
  if (!src || !state) return <div className="grid h-[60vh] place-items-center text-muted">Opening the record…</div>;

  function continueFromHere() {
    const t = Date.now();
    const id = newId();
    saveLocal({ id, mode: "local", rules: src!.rules, moves: src!.moves.slice(0, ply), label: `From: ${src!.title}`, human: "w", createdAt: t, updatedAt: t });
    setCurrentGameId(id);
    router.push(`/play?id=${id}`);
  }

  const total = src.moves.length;
  const v = describeVariants(src.rules);
  const sidebar = (
    <div className="space-y-3">
      <div className="card !p-3 text-sm">
        <div className="font-display text-lg font-semibold">{src.title}</div>
        <div className="text-xs text-muted">
          {expansionLabel(src.rules)}
          {v.length ? `, ${v.join(", ")}` : ""}. {src.result ? `${resultSentence(src.result, src.reason)}.` : "Unfinished."}
        </div>
      </div>
      <div className="card space-y-3 !p-3">
        <input type="range" min={0} max={total} value={ply} onChange={(e) => setPly(Number(e.target.value))} className="w-full" aria-label="Move" />
        <div className="text-center text-xs text-muted">
          Move {ply} of {total}
          {ply > 0 ? `: ${src.moves[ply - 1]}` : ""}
        </div>
      </div>
    </div>
  );

  const actions: GameAction[] = [
    { id: "first", icon: "first", label: "Start", onClick: () => setPly(0), disabled: ply === 0 },
    { id: "prev", icon: "prev", label: "Back", onClick: () => setPly((p) => Math.max(0, p - 1)), disabled: ply === 0 },
    { id: "play", icon: playing ? "pause" : "play", label: playing ? "Pause" : "Autoplay", onClick: () => (ply >= total ? (setPly(0), setPlaying(true)) : setPlaying((p) => !p)), active: playing },
    { id: "next", icon: "next", label: "Next", onClick: () => setPly((p) => Math.min(total, p + 1)), disabled: ply >= total },
    { id: "last", icon: "last", label: "End", onClick: () => setPly(total), disabled: ply >= total },
    { id: "eval", icon: "eval", label: evalOn ? "Hide evaluation" : "Evaluate positions", onClick: () => setEvalOn((x) => !x), active: evalOn, menu: true },
    { id: "playon", icon: "play", label: "Play on from here", onClick: continueFromHere, menu: true },
  ];

  return (
    <div>
      <GameView
        actions={actions}
        state={state}
        theme={theme}
        onThemeChange={(t) => {
          setTheme(t);
          saveTheme(t);
        }}
        canMove={false}
        onPlay={() => {}}
        getPreview={getPreview}
        players={src.players}
        bottom="w"
        status={ply === 0 ? "Start of game" : `After move ${ply}: ${src.moves[ply - 1]}`}
        sidebar={sidebar}
        analysis={evalOn ? <EvalBar result={evalResult} loading={evalLoading} /> : null}
      />
    </div>
  );
}

export default function ReplayPage() {
  return (
    <Suspense fallback={<div className="grid h-[60vh] place-items-center text-muted">Opening the record…</div>}>
      <Replay />
    </Suspense>
  );
}
