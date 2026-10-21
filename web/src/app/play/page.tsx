"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { EvalBar } from "@/components/EvalBar";
import { GameView } from "@/components/GameView";
import { AiClient } from "@/lib/ai-client";
import { Engine, engineFromMoves, errorMessage, loadEngine } from "@/lib/engine";
import { colorName, LEVELS, resultText, type AiResult, type ColorCode, type StateView } from "@/lib/engine-types";
import { loadSavedGame, saveGame, settingsFromQuery, settingsToQuery, type LocalSettings, type SavedGame } from "@/lib/settings";
import { loadTheme, saveTheme, type ThemeId } from "@/lib/themes";

type Result = SavedGame["result"];

function LocalGame() {
  const params = useSearchParams();
  const router = useRouter();
  const [settings, setSettings] = useState<LocalSettings | null>(null);
  const [state, setState] = useState<StateView | null>(null);
  const [theme, setTheme] = useState<ThemeId>("flat");
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<AiResult | null>(null);
  const [hintLoading, setHintLoading] = useState(false);
  const [showEval, setShowEval] = useState(false);
  const [evalResult, setEvalResult] = useState<AiResult | null>(null);
  const [evalLoading, setEvalLoading] = useState(false);
  const [result, setResult] = useState<{ status: Result; reason?: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const engine = useRef<Engine | null>(null);
  const cpu = useRef<AiClient | null>(null);
  const analyst = useRef<AiClient | null>(null);
  /** Bumped on every position change so stale AI replies are ignored. */
  const generation = useRef(0);

  // ---- Setup -----------------------------------------------------------
  useEffect(() => {
    setTheme(loadTheme());
    setShowEval(localStorage.getItem("hive.eval") === "1");
    cpu.current = new AiClient();
    analyst.current = new AiClient();
    let cancelled = false;
    (async () => {
      await loadEngine();
      if (cancelled) return;
      let s = settingsFromQuery(new URLSearchParams(params.toString()));
      let moves: string[] = [];
      let saved: SavedGame | null = null;
      if (!s || params.get("resume")) {
        saved = loadSavedGame();
        if (!saved) {
          router.replace("/");
          return;
        }
        s = saved.settings;
        moves = saved.moves;
      }
      try {
        engine.current = engineFromMoves(s.rules, moves);
      } catch (e) {
        setError("Saved game couldn't be restored: " + errorMessage(e));
        engine.current = Engine.create(s.rules);
      }
      if (saved?.result) {
        engine.current.setResult(saved.result);
        setResult({ status: saved.result, reason: saved.resultReason });
      }
      setSettings(s);
      setState(engine.current.state());
      if (!saved) saveGame({ settings: s, moves: [] });
    })();
    return () => {
      cancelled = true;
      cpu.current?.terminate();
      analyst.current?.terminate();
      engine.current?.free();
      engine.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refresh = useCallback(
    (res?: { status: Result; reason?: string } | null) => {
      const e = engine.current;
      if (!e || !settings) return;
      generation.current++;
      const s = e.state();
      setState(s);
      setHint(null);
      const over = s.status === "WhiteWins" || s.status === "BlackWins" || s.status === "Draw";
      const finalResult = res ?? (over ? { status: s.status as Result, reason: "surround" } : null);
      setResult(finalResult);
      saveGame({ settings, moves: s.history, result: finalResult?.status, resultReason: finalResult?.reason });
    },
    [settings],
  );

  const isCpuTurn = !!state && !!settings && settings.mode === "cpu" && state.toMove !== settings.human && !result;

  // ---- CPU opponent ------------------------------------------------------
  useEffect(() => {
    if (!isCpuTurn || !state || !settings || !engine.current) return;
    const gen = generation.current;
    setThinking(true);
    const started = Date.now();
    cpu.current!
      .choose(state.gameString, settings.rules.tournament, settings.level)
      .then(async (r) => {
        // Keep very fast replies from feeling instant.
        const wait = 450 - (Date.now() - started);
        if (wait > 0) await new Promise((res) => setTimeout(res, wait));
        if (gen !== generation.current || !engine.current) return;
        setThinking(false);
        engine.current.play(r.best);
        refresh();
      })
      .catch((e) => {
        if (gen === generation.current) setError("CPU error: " + errorMessage(e));
      })
      .finally(() => {
        if (gen === generation.current) setThinking(false);
      });
  }, [isCpuTurn, state, settings, refresh]);

  // ---- Evaluation bar ----------------------------------------------------
  useEffect(() => {
    if (!showEval || !state || !settings || result) return;
    const gen = generation.current;
    setEvalLoading(true);
    analyst.current!
      .analyze(state.gameString, settings.rules.tournament, 900)
      .then((r) => {
        if (gen === generation.current) setEvalResult(r);
      })
      .catch(() => {})
      .finally(() => {
        if (gen === generation.current) setEvalLoading(false);
      });
  }, [showEval, state, settings, result]);

  if (!state || !settings) {
    return <div className="p-8 text-center text-[var(--muted)]">{error ?? "Loading game…"}</div>;
  }

  const humanCanMove = !result && (settings.mode === "local" || state.toMove === settings.human) && !thinking;

  function play(notation: string) {
    if (!engine.current) return;
    try {
      engine.current.play(notation);
      setError(null);
      refresh();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  function undo() {
    const e = engine.current;
    if (!e || !settings) return;
    generation.current++;
    setThinking(false);
    if (result) {
      // Reopen a finished game: replay the moves without the result.
      const moves = e.state().history;
      e.free();
      engine.current = engineFromMoves(settings.rules, moves);
    }
    const target = settings.mode === "cpu" ? settings.human : null;
    let n = 0;
    do {
      if (!engine.current!.undo()) break;
      n++;
    } while (target && engine.current!.state().toMove !== target && engine.current!.state().ply > 0);
    if (n > 0 || result) refresh(null);
  }

  async function askHint() {
    if (!state || !settings) return;
    setHintLoading(true);
    const gen = generation.current;
    try {
      const r = await analyst.current!.analyze(state.gameString, settings.rules.tournament, 1500);
      if (gen === generation.current) setHint(r);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setHintLoading(false);
    }
  }

  function resign() {
    if (!engine.current || !state) return;
    const loser: ColorCode = settings!.mode === "cpu" ? settings!.human : state.toMove;
    const status = loser === "w" ? "BlackWins" : "WhiteWins";
    engine.current.setResult(status);
    refresh({ status, reason: "resignation" });
  }

  function agreeDraw() {
    engine.current?.setResult("Draw");
    refresh({ status: "Draw", reason: "agreement" });
  }

  async function copyGame() {
    await navigator.clipboard.writeText(engine.current!.gameString());
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const levelName = LEVELS.find((l) => l.id === settings.level)?.name;
  const labels: Record<ColorCode, React.ReactNode> =
    settings.mode === "cpu"
      ? {
          w: settings.human === "w" ? "You (White)" : `CPU · ${levelName} (White)`,
          b: settings.human === "b" ? "You (Black)" : `CPU · ${levelName} (Black)`,
        }
      : { w: "White", b: "Black" };

  const status = result
    ? `${resultText(result.status!)}${result.reason && result.reason !== "surround" ? ` (${result.reason})` : ""}`
    : thinking
      ? `${colorName(state.toMove)} (CPU) is thinking…`
      : `${colorName(state.toMove)} to move · turn ${state.turn}`;

  const youWon = result && settings.mode === "cpu" && ((result.status === "WhiteWins" && settings.human === "w") || (result.status === "BlackWins" && settings.human === "b"));

  const sidebar = (
    <div className="space-y-3">
      {error && <div className="rounded-lg bg-red-50 p-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</div>}
      {result && (
        <div className="card text-center">
          <div className="text-lg font-bold">
            {settings.mode === "cpu" ? (result.status === "Draw" ? "Draw" : youWon ? "You win! 🎉" : "The CPU wins") : resultText(result.status!)}
          </div>
          <div className="text-xs text-[var(--muted)]">
            {result.reason === "surround" ? "Queen surrounded" : result.reason === "resignation" ? "By resignation" : result.reason === "agreement" ? "By agreement" : ""}
          </div>
          <div className="mt-3 flex justify-center gap-2">
            <button
              className="btn"
              onClick={() => {
                const next = settings.mode === "cpu" ? { ...settings, human: (settings.human === "w" ? "b" : "w") as ColorCode } : settings;
                window.location.href = `/play?${settingsToQuery(next)}`;
              }}
            >
              Rematch{settings.mode === "cpu" ? " (swap colours)" : ""}
            </button>
            <Link className="btn-secondary" href="/">
              New game
            </Link>
          </div>
        </div>
      )}
      {state.mustPass && humanCanMove && (
        <div className="card text-sm">
          <p className="mb-2">{colorName(state.toMove)} has no legal moves and must pass.</p>
          <button className="btn w-full" onClick={() => play("pass")}>
            Pass
          </button>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <button className="btn-secondary" onClick={undo} disabled={state.ply === 0 && !result}>
          ↶ Undo
        </button>
        <button className="btn-secondary" onClick={askHint} disabled={!humanCanMove || hintLoading}>
          {hintLoading ? "Thinking…" : "💡 Hint"}
        </button>
        {!result && (
          <>
            <button className="btn-secondary" onClick={resign} disabled={state.ply === 0}>
              🏳 Resign
            </button>
            {settings.mode === "local" ? (
              <button className="btn-secondary" onClick={agreeDraw} disabled={state.ply === 0}>
                ½ Agree draw
              </button>
            ) : (
              <span />
            )}
          </>
        )}
      </div>
      {hint && (
        <div className="rounded-lg border border-purple-300 bg-purple-50 p-2 text-sm dark:border-purple-800 dark:bg-purple-950/40">
          Suggested: <span className="font-mono font-semibold">{hint.best}</span>
          <span className="block text-xs text-[var(--muted)]">
            {hint.engine} · {hint.depth ? `depth ${hint.depth}` : `${hint.nodes} simulations`}
            {hint.pv.length > 1 ? ` · line: ${hint.pv.slice(0, 4).join(", ")}` : ""}
          </span>
        </div>
      )}
      {state.repetitions >= 3 && !result && (
        <p className="text-xs text-[var(--muted)]">This position has now occurred {state.repetitions} times. Hive has no automatic repetition rule; agree a draw if you&apos;re going in circles.</p>
      )}
      <div className="flex flex-wrap gap-2 text-xs">
        <button className="btn-ghost" onClick={copyGame}>
          {copied ? "Copied!" : "Copy game notation"}
        </button>
        <label className="btn-ghost cursor-pointer gap-1">
          <input
            type="checkbox"
            className="accent-amber-500"
            checked={showEval}
            onChange={(e) => {
              setShowEval(e.target.checked);
              localStorage.setItem("hive.eval", e.target.checked ? "1" : "0");
            }}
          />
          Evaluation bar
        </label>
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
      canMove={humanCanMove}
      onPlay={play}
      labels={labels}
      bottom={settings.mode === "cpu" ? settings.human : "w"}
      hint={hint?.best ?? null}
      status={status}
      sidebar={sidebar}
      analysis={showEval ? <EvalBar result={evalResult} loading={evalLoading} /> : null}
    />
  );
}

export default function PlayPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-[var(--muted)]">Loading…</div>}>
      <LocalGame />
    </Suspense>
  );
}
