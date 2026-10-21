"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { EvalBar } from "@/components/EvalBar";
import { ClockFace, GameOverCard, NewGameLink } from "@/components/GameBits";
import { Icon } from "@/components/Icon";
import { GameView, type GameAction, type PlayerInfo } from "@/components/GameView";
import { AiClient } from "@/lib/ai-client";
import { useAuth } from "@/lib/auth";
import { Engine, engineFromMoves, errorMessage, loadEngine } from "@/lib/engine";
import { colorName, levelInfo, resultText, type AiResult, type ColorCode, type StateView } from "@/lib/engine-types";
import { currentGameId, gameTitle, getLocal, newId, REASON_TEXT, saveCloud, saveLocal, setCurrentGameId, type GameResult, type JournalEntry } from "@/lib/journal";
import { loadTheme, saveTheme, type ThemeId } from "@/lib/themes";
import { describeVariants, expansionLabel } from "@/lib/variants";

function LocalGame() {
  const params = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const [entry, setEntry] = useState<JournalEntry | null>(null);
  const [state, setState] = useState<StateView | null>(null);
  const [theme, setTheme] = useState<ThemeId>("field");
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<AiResult | null>(null);
  const [hintLoading, setHintLoading] = useState(false);
  const [showEval, setShowEval] = useState(false);
  const [evalResult, setEvalResult] = useState<AiResult | null>(null);
  const [evalLoading, setEvalLoading] = useState(false);
  const [overlayClosed, setOverlayClosed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [clockLeft, setClockLeft] = useState<[number, number] | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const engine = useRef<Engine | null>(null);
  const cpu = useRef<AiClient | null>(null);
  const analyst = useRef<AiClient | null>(null);
  const generation = useRef(0);
  const turnStart = useRef(Date.now());
  const entryRef = useRef<JournalEntry | null>(null);
  entryRef.current = entry;
  const userRef = useRef(user);
  userRef.current = user;

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
      const id = params.get("id") ?? (params.get("resume") ? currentGameId() : null);
      const e = id ? getLocal(id) : null;
      if (!e) {
        router.replace("/");
        return;
      }
      try {
        engine.current = engineFromMoves(e.rules, e.moves);
      } catch (err) {
        setError("This saved game couldn't be restored: " + errorMessage(err));
        engine.current = Engine.create(e.rules);
      }
      if (e.result) engine.current.setResult(e.result);
      setEntry(e);
      if (e.clock?.baseMs) setClockLeft(e.clockLeft ?? [e.clock.baseMs, e.clock.baseMs]);
      turnStart.current = Date.now();
      setState(engine.current.state());
      if (!e.result) setCurrentGameId(e.id);
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

  /** Re-reads the engine state and saves the game to the journal. */
  const commit = useCallback((patch: Partial<JournalEntry> = {}, left: [number, number] | null = null) => {
    const e = engine.current;
    const cur = entryRef.current;
    if (!e || !cur) return;
    generation.current++;
    const s = e.state();
    setState(s);
    setHint(null);
    setEvalResult(null);
    const over = s.status === "WhiteWins" || s.status === "BlackWins" || s.status === "Draw";
    const result: GameResult | undefined = "result" in patch ? patch.result : over ? (s.status as GameResult) : undefined;
    const resultReason = "resultReason" in patch ? patch.resultReason : over ? (s.endReason ?? "surround") : undefined;
    const next: JournalEntry = { ...cur, ...patch, moves: s.history, result, resultReason, clockLeft: left ?? cur.clockLeft, updatedAt: Date.now() };
    setEntry(next);
    saveLocal(next);
    if (result) {
      setCurrentGameId(null);
      setOverlayClosed(false);
    }
    const u = userRef.current;
    if (u && (result || next.moves.length % 6 === 0)) saveCloud(u.id, next).catch(() => {});
  }, []);

  /** Applies clock bookkeeping for the side that just moved. */
  const tickClock = useCallback((mover: ColorCode, ply: number): [number, number] | null => {
    const cur = entryRef.current;
    if (!cur?.clock?.baseMs) return null;
    const t = Date.now();
    const elapsed = t - turnStart.current;
    turnStart.current = t;
    let left: [number, number] = [0, 0];
    setClockLeft((prev) => {
      const l: [number, number] = [...(prev ?? [cur.clock!.baseMs!, cur.clock!.baseMs!])] as [number, number];
      const i = mover === "w" ? 0 : 1;
      // The clock starts after White's first move.
      if (ply > 0) l[i] = Math.max(0, l[i] - elapsed) + cur.clock!.incMs;
      left = l;
      return l;
    });
    return left;
  }, []);

  const result = entry?.result;
  const isCpuTurn = !!state && !!entry && entry.mode === "cpu" && state.toMove !== entry.human && !result;

  // ---- CPU opponent ------------------------------------------------------
  useEffect(() => {
    if (!isCpuTurn || !state || !entry || !engine.current) return;
    const gen = generation.current;
    setThinking(true);
    const started = Date.now();
    cpu.current!
      .choose(entry.rules, state.history, entry.level ?? "medium")
      .then(async (r) => {
        const wait = 500 - (Date.now() - started);
        if (wait > 0) await new Promise((res) => setTimeout(res, wait));
        if (gen !== generation.current || !engine.current) return;
        setThinking(false);
        const mover = state.toMove;
        engine.current.play(r.best);
        commit({}, tickClock(mover, state.ply));
      })
      .catch((e) => {
        if (gen === generation.current) {
          setThinking(false);
          setError("CPU error: " + errorMessage(e));
        }
      });
  }, [isCpuTurn, state, entry, commit, tickClock]);

  // ---- Evaluation bar ----------------------------------------------------
  useEffect(() => {
    if (!showEval || !state || !entry || result) return;
    const gen = generation.current;
    setEvalLoading(true);
    analyst.current!
      .analyze(entry.rules, state.history, 900)
      .then((r) => gen === generation.current && setEvalResult(r))
      .catch(() => {})
      .finally(() => gen === generation.current && setEvalLoading(false));
  }, [showEval, state, entry, result]);

  // ---- Clocks ------------------------------------------------------------------
  const timed = !!entry?.clock?.baseMs && !!clockLeft;
  const running = timed && !result && (state?.ply ?? 0) > 0;
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, [running]);
  const shown = (c: ColorCode) => {
    if (!clockLeft) return 0;
    const base = clockLeft[c === "w" ? 0 : 1];
    return running && state?.toMove === c ? base - (now - turnStart.current) : base;
  };
  useEffect(() => {
    if (!running || !state || !engine.current) return;
    if (shown(state.toMove) <= 0) {
      const status: GameResult = state.toMove === "w" ? "BlackWins" : "WhiteWins";
      engine.current.setResult(status);
      const left: [number, number] = [...clockLeft!] as [number, number];
      left[state.toMove === "w" ? 0 : 1] = 0;
      setClockLeft(left);
      commit({ result: status, resultReason: "time" }, left);
    }
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const getPreview = useCallback((piece: string) => engine.current!.preview(piece), []);

  if (!state || !entry) {
    return <div className="grid h-[60vh] place-items-center text-muted">{error ?? "Laying out the tiles…"}</div>;
  }

  const humanCanMove = !result && (entry.mode === "local" || state.toMove === entry.human) && !thinking;

  function play(notation: string) {
    if (!engine.current || !state) return;
    try {
      const mover = state.toMove;
      engine.current.play(notation);
      setError(null);
      commit({}, tickClock(mover, state.ply));
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  function undo() {
    const e = engine.current;
    if (!e || !entry) return;
    generation.current++;
    setThinking(false);
    if (result) {
      const moves = e.state().history;
      e.free();
      engine.current = engineFromMoves(entry.rules, moves);
    }
    const target = entry.mode === "cpu" ? entry.human : null;
    let n = 0;
    do {
      if (!engine.current!.undo()) break;
      n++;
    } while (target && engine.current!.state().toMove !== target && engine.current!.state().ply > 0);
    turnStart.current = Date.now();
    if (n > 0 || result) {
      commit({ result: undefined, resultReason: undefined });
      setCurrentGameId(entry.id);
    }
  }

  async function askHint() {
    if (!state || !entry) return;
    setHintLoading(true);
    const gen = generation.current;
    try {
      const r = await analyst.current!.analyze(entry.rules, state.history, 1500);
      if (gen === generation.current) setHint(r);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setHintLoading(false);
    }
  }

  function resign() {
    if (!engine.current || !state || !entry) return;
    const loser: ColorCode = entry.mode === "cpu" ? entry.human : state.toMove;
    const status: GameResult = loser === "w" ? "BlackWins" : "WhiteWins";
    engine.current.setResult(status);
    commit({ result: status, resultReason: "resignation" });
  }

  function agreeDraw() {
    engine.current?.setResult("Draw");
    commit({ result: "Draw", resultReason: "agreement" });
  }

  function rematch() {
    if (!entry) return;
    const t = Date.now();
    const next: JournalEntry = {
      ...entry,
      id: newId(),
      moves: [],
      result: undefined,
      resultReason: undefined,
      clockLeft: undefined,
      human: entry.mode === "cpu" ? (entry.human === "w" ? "b" : "w") : "w",
      createdAt: t,
      updatedAt: t,
    };
    saveLocal(next);
    setCurrentGameId(next.id);
    window.location.href = `/play?id=${next.id}`;
  }

  async function copyGame() {
    await navigator.clipboard.writeText(engine.current!.gameString());
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const cpuLevel = entry.level ? levelInfo(entry.level) : null;
  const players: Record<ColorCode, PlayerInfo> = {
    w: { name: "White" },
    b: { name: "Black" },
  };
  for (const c of ["w", "b"] as ColorCode[]) {
    if (entry.mode === "cpu" && cpuLevel) {
      players[c] =
        c === entry.human ? { name: "You", sub: colorName(c) } : { name: "Computer", sub: `${cpuLevel.name} · ${colorName(c)}`, thinking: thinking && state.toMove === c };
    } else {
      players[c] = { name: colorName(c) };
    }
    if (timed) players[c].clock = <ClockFace ms={shown(c)} running={running && state.toMove === c} />;
  }

  const youWon = result && entry.mode === "cpu" && ((result === "WhiteWins" && entry.human === "w") || (result === "BlackWins" && entry.human === "b"));
  const status = result
    ? `${resultText(result)} · ${REASON_TEXT[entry.resultReason ?? ""] ?? ""}`
    : thinking
      ? "Computer is thinking…"
      : state.mustPass
        ? `${colorName(state.toMove)} has no legal move and must pass`
        : `${entry.mode === "local" ? colorName(state.toMove) : state.toMove === entry.human ? "Your" : colorName(state.toMove)}${entry.mode === "local" || state.toMove !== entry.human ? " to move" : " move"} · turn ${state.turn}`;

  const variants = describeVariants(entry.rules);
  const overlay =
    result && !overlayClosed ? (
      <GameOverCard
        tone={entry.mode === "cpu" ? (result === "Draw" ? "draw" : youWon ? "win" : "loss") : "neutral"}
        title={entry.mode === "cpu" ? (result === "Draw" ? "A draw" : youWon ? "You win!" : "Computer wins") : resultText(result)}
        subtitle={REASON_TEXT[entry.resultReason ?? ""]}
        detail={`${state.history.length} moves · ${gameTitle(entry)}`}
        onClose={() => setOverlayClosed(true)}
        actions={
          <>
            <button className="btn" onClick={rematch}>
              {entry.mode === "cpu" ? "Rematch, swap colours" : "Play again"}
            </button>
            <Link className="btn-secondary" href={`/replay?local=${entry.id}`}>
              Review game
            </Link>
            <NewGameLink />
          </>
        }
      />
    ) : null;

  const notice = error ? <div className="note-error">{error}</div> : null;
  const sidebar = (
    <div className="space-y-3">
      {state.mustPass && humanCanMove && (
        <div className="note-warn">
          <p className="mb-2">{colorName(state.toMove)} has no legal moves and must pass.</p>
          <button className="btn w-full" onClick={() => play("pass")}>
            Pass
          </button>
        </div>
      )}
      {hint && (
        <div className="note-hint">
          Try <span className="font-mono font-semibold">{hint.best}</span>. It&apos;s marked on the board with a purple arrow.
        </div>
      )}
      {state.repetitions >= 3 && !result && !entry.rules.repetitionDraw && (
        <p className="note-info text-xs">This position has come up {state.repetitions} times. Agree a draw if you&apos;re going in circles.</p>
      )}
    </div>
  );
  const footer = (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
      <span>
        {expansionLabel(entry.rules)}
        {variants.length ? ` · ${variants.join(" · ")}` : ""}
        {entry.clock?.baseMs ? ` · ${entry.clock.baseMs / 60000} + ${entry.clock.incMs / 1000}s` : ""}
      </span>
      <button className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-ink" onClick={copyGame}>
        <Icon name={copied ? "check" : "copy"} size={14} />
        {copied ? "Copied" : "Copy notation"}
      </button>
    </div>
  );

  const toggleEval = () => setShowEval((v) => (localStorage.setItem("hive.eval", v ? "0" : "1"), !v));
  const actions: GameAction[] = [
    ...(state.mustPass && humanCanMove ? [{ id: "pass", icon: "skip" as const, label: "Pass", onClick: () => play("pass"), active: true }] : []),
    { id: "undo", icon: "undo", label: "Take back", short: "Undo", onClick: undo, disabled: state.ply === 0 && !result },
    { id: "hint", icon: "hint", label: hintLoading ? "Thinking…" : "Hint", onClick: askHint, disabled: !humanCanMove || hintLoading, busy: hintLoading, active: !!hint },
    { id: "eval", icon: "eval", label: showEval ? "Hide eval" : "Show eval", short: "Eval", onClick: toggleEval, active: showEval, disabled: !!result, menu: true },
    ...(result
      ? [{ id: "result", icon: "eye" as const, label: "Show result", short: "Result", onClick: () => setOverlayClosed(false) }]
      : [
          ...(entry.mode === "local" ? [{ id: "draw", icon: "draw" as const, label: "Agree draw", short: "Draw", onClick: agreeDraw, disabled: state.ply === 0, menu: true }] : []),
          { id: "resign", icon: "flag" as const, label: "Resign", onClick: () => confirm("Resign this game?") && resign(), disabled: state.ply === 0, menu: true },
        ]),
  ];

  return (
    <GameView
      actions={actions}
      footer={footer}
      notice={notice}
      state={state}
      theme={theme}
      onThemeChange={(t) => {
        setTheme(t);
        saveTheme(t);
      }}
      canMove={humanCanMove}
      onPlay={play}
      getPreview={getPreview}
      players={players}
      bottom={entry.mode === "cpu" ? entry.human : "w"}
      hint={hint?.best ?? null}
      status={status}
      sidebar={sidebar}
      analysis={showEval && !result ? <EvalBar result={evalResult} loading={evalLoading} /> : null}
      overlay={overlay}
    />
  );
}

export default function PlayPage() {
  return (
    <Suspense fallback={<div className="grid h-[60vh] place-items-center text-muted">Laying out the tiles…</div>}>
      <LocalGame />
    </Suspense>
  );
}
