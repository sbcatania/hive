"use client";

import Link from "next/link";
import { Sheet } from "@/components/Sheet";
import { useAppScreen } from "@/lib/app-screen";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Board2D from "@/components/Board2D";
import { HandPanel } from "@/components/HandPanel";
import { AiClient } from "@/lib/ai-client";
import { errorMessage, loadEngine, withEngine } from "@/lib/engine";
import { BUG_NAMES, colorName, normalizeRules, type BugLetter, type ColorCode, type MoveView, type StateView } from "@/lib/engine-types";
import PUZZLES from "@/lib/puzzles.json";
import { loadTheme, type ThemeId } from "@/lib/themes";
import { Icon } from "@/components/Icon";

interface Puzzle {
  kind: "win1" | "win2";
  rules: string;
  moves: string[];
  solutions: string[];
}

const LIST = (PUZZLES as Puzzle[]).map((p, i) => ({ ...p, id: `p${i + 1}` }));
const SOLVED_KEY = "hive.puzzles.solved";

function rulesOf(p: Puzzle) {
  const ext = p.rules.split("+")[1] ?? "";
  return normalizeRules({ mosquito: ext.includes("M"), ladybug: ext.includes("L"), pillbug: ext.includes("P"), tournament: true });
}

function loadSolved(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(SOLVED_KEY) ?? "[]"));
  } catch {
    return new Set();
  }
}

type Phase = "solve" | "checking" | "defending" | "finish" | "solved" | "wrong";

function PuzzlePlayer({ puzzle, onSolved, onNext }: { puzzle: (typeof LIST)[number]; onSolved: () => void; onNext: () => void }) {
  const rules = useMemo(() => rulesOf(puzzle), [puzzle]);
  const [moves, setMoves] = useState<string[]>(puzzle.moves);
  const [phase, setPhase] = useState<Phase>("solve");
  const [selected, setSelected] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [theme, setTheme] = useState<ThemeId>("field");
  const ai = useRef<AiClient | null>(null);

  useEffect(() => {
    setTheme("field");
    ai.current = new AiClient();
    return () => ai.current?.terminate();
  }, []);

  useEffect(() => {
    setMoves(puzzle.moves);
    setPhase("solve");
    setSelected(null);
    setMessage(null);
  }, [puzzle]);

  const state: StateView = useMemo(() => withEngine(rules, moves, (e) => e.state()), [rules, moves]);
  const solver: ColorCode = puzzle.moves.length % 2 === 0 ? "w" : "b";
  const myTurn = (phase === "solve" || phase === "finish") && state.toMove === solver;
  const targets = selected && myTurn ? state.legalMoves.filter((m) => m.piece === selected) : [];
  const selectable = useMemo(() => new Set(myTurn ? state.legalMoves.filter((m) => m.from).map((m) => m.piece) : []), [state, myTurn]);
  const placeable = useMemo(() => new Set(myTurn ? state.legalMoves.filter((m) => !m.from).map((m) => m.piece) : []), [state, myTurn]);

  const solverWins = (s: StateView) => s.status === (solver === "w" ? "WhiteWins" : "BlackWins");

  const reset = useCallback(
    (msg: string) => {
      setPhase("wrong");
      setMessage(msg);
      setTimeout(() => {
        setMoves(puzzle.moves);
        setPhase("solve");
      }, 1700);
    },
    [puzzle],
  );

  async function play(m: MoveView) {
    setSelected(null);
    const next = [...moves, m.notation];
    const after = withEngine(rules, next, (e) => e.state());
    setMoves(next);
    if (solverWins(after)) {
      setPhase("solved");
      setMessage(puzzle.kind === "win1" ? "The Queen is surrounded!" : "Checkmate in two. Beautifully done.");
      onSolved();
      return;
    }
    if (puzzle.kind === "win1" || phase === "finish") {
      reset(phase === "finish" ? "So close, but that doesn't finish it. Try again from the start." : "That doesn't surround the Queen. Look again.");
      return;
    }
    // Win in 2: the first move must still force a win against any defence.
    setPhase("checking");
    try {
      let forcing = puzzle.solutions.includes(m.notation);
      if (!forcing) {
        const r = await ai.current!.analyze(rules, next, 2500);
        forcing = (solver === "w" ? r.scoreWhite : -r.scoreWhite) >= 999_000;
      }
      if (!forcing) {
        reset(`That lets ${colorName(solver === "w" ? "b" : "w")} escape. Try again.`);
        return;
      }
      setPhase("defending");
      setMessage("Good! Sable is looking for a defence…");
      const d = await ai.current!.choose(rules, next, "hard", 1200);
      await new Promise((res) => setTimeout(res, 500));
      setMoves([...next, d.best]);
      setPhase("finish");
      setMessage(`${colorName(solver === "w" ? "b" : "w")} replied ${d.best}. Now finish it.`);
    } catch (e) {
      setMessage(errorMessage(e));
      setPhase("solve");
    }
  }

  function onPieceClick(name: string) {
    if (selected) {
      const p = state.pieces.find((x) => x.name === name);
      const climb = p && targets.find((m) => m.to[0] === p.q && m.to[1] === p.r);
      if (climb) return void play(climb);
    }
    setSelected(name === selected ? null : selectable.has(name) || placeable.has(name) ? name : null);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 lg:block lg:space-y-3">
      <div className={`card flex shrink-0 items-center justify-between gap-3 !px-3 !py-2 lg:!px-4 lg:!py-3 ${phase === "solved" ? "[--bc:var(--move)] [--fill:color-mix(in_oklab,var(--move)_12%,var(--card))]" : phase === "wrong" ? "[--bc:var(--danger)] [--fill:color-mix(in_oklab,var(--danger)_10%,var(--card))]" : ""}`}>
        <div>
          <div className="font-display text-lg font-semibold lg:text-xl">
            {colorName(solver)} to play and win in {puzzle.kind === "win1" ? "one" : "two"}
          </div>
          <div className="text-[0.85rem] text-ink-soft lg:text-sm">{message ?? (puzzle.kind === "win1" ? "Find the move that completes the surround." : "Find a move after which every defence loses.")}</div>
        </div>
        {phase === "solved" && (
          <button className="btn shrink-0" onClick={onNext}>
            Next puzzle
            <Icon name="next" size={18} />
          </button>
        )}
      </div>
      <div className="card relative min-h-0 flex-1 !p-0 [--fill:transparent] lg:h-[52vh] lg:min-h-80 lg:flex-none">
        <div className="sk-lg absolute inset-[3px] overflow-hidden">
        <Board2D state={state} selected={selected} targets={targets} theme={theme} selectable={selectable} onPieceClick={onPieceClick} onTargetClick={play} onBackgroundClick={() => setSelected(null)} hideLastMove={moves.length === puzzle.moves.length} />
        </div>
      </div>
      <HandPanel className="shrink-0" color={solver} hand={state.hands[solver === "w" ? 0 : 1]} selected={selected} placeable={placeable} onSelect={(n) => setSelected(n === selected ? null : n)} />
      <div className="flex shrink-0 gap-2" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 4px)" }}>
        <button className="btn-secondary" onClick={() => (setMoves(puzzle.moves), setPhase("solve"), setMessage(null))}>
          <Icon name="refresh" size={16} />
          Restart
        </button>
        <button
          className="btn-secondary"
          onClick={() => setMessage(`Hint: the key piece is your ${BUG_NAMES[puzzle.solutions[0][1] as BugLetter] ?? "piece"}.`)}
          disabled={phase === "solved"}
        >
          <Icon name="hint" size={16} />
          Hint
        </button>
      </div>
    </div>
  );
}

export default function PuzzlesPage() {
  const [ready, setReady] = useState(false);
  const [solved, setSolved] = useState<Set<string>>(new Set());
  const [current, setCurrent] = useState(0);
  const [list, setList] = useState(false);
  useAppScreen(1023);

  useEffect(() => {
    loadEngine().then(() => setReady(true));
    const s = loadSolved();
    setSolved(s);
    const firstOpen = LIST.findIndex((p) => !s.has(p.id));
    setCurrent(firstOpen < 0 ? 0 : firstOpen);
  }, []);

  const markSolved = (id: string) =>
    setSolved((s) => {
      const n = new Set(s).add(id);
      try {
        localStorage.setItem(SOLVED_KEY, JSON.stringify([...n]));
      } catch {}
      return n;
    });

  const p = LIST[current];
  const grid = (
    <ol className="grid grid-cols-5 gap-2 self-start sm:grid-cols-8 lg:grid-cols-3">
      {LIST.map((q, i) => (
        <li key={q.id}>
          <button
            onClick={() => {
              setCurrent(i);
              setList(false);
            }}
            className={`pencil flex aspect-square w-full flex-col items-center justify-center text-sm transition ${i === current ? "pencil-honey pencil-strong" : "pencil-clear hover:[--fill:var(--card)]"}`}
            aria-label={`Puzzle ${i + 1}, win in ${q.kind === "win1" ? 1 : 2}${solved.has(q.id) ? ", solved" : ""}`}
          >
            <span className="font-display text-lg font-semibold">{i + 1}</span>
            <span className="font-hand text-sm leading-none text-muted">{q.kind === "win1" ? "in 1" : "in 2"}</span>
            {solved.has(q.id) && <span className="anim-pop absolute top-1.5 right-1.5 h-[11px] w-[10px] bg-accent [clip-path:polygon(50%_0,100%_25%,100%_75%,50%_100%,0_75%,0_25%)]" aria-hidden />}
          </button>
        </li>
      ))}
    </ol>
  );
  const step = (d: number) => setCurrent((c) => (c + d + LIST.length) % LIST.length);
  return (
    <div className="mx-auto max-w-6xl px-3 pt-2 max-lg:flex max-lg:h-[calc(100dvh-var(--header-h))] max-lg:flex-col lg:px-4 lg:py-8">
      <div className="hidden lg:block">
        <h1 className="font-display text-4xl font-semibold">Puzzles</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Real positions from engine games, checked by the engine. {solved.size} of {LIST.length} solved. New to the rules? <Link href="/learn" className="underline">Read how to play</Link>.
        </p>
      </div>
      <div className="mb-2 flex shrink-0 items-center gap-2 lg:hidden">
        <button className="icon-btn !h-10 !w-10 [--fill:transparent]" onClick={() => step(-1)} aria-label="Previous puzzle">
          <Icon name="prev" />
        </button>
        <button className="min-w-0 flex-1 text-center" onClick={() => setList(true)}>
          <span className="font-display text-lg font-semibold">Puzzle {current + 1}</span>
          <span className="text-sm text-muted">
            {" "}
            of {LIST.length}, {solved.size} solved
          </span>
        </button>
        <button className="icon-btn !h-10 !w-10 [--fill:transparent]" onClick={() => step(1)} aria-label="Next puzzle">
          <Icon name="next" />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col lg:mt-6 lg:grid lg:grid-cols-[16rem_1fr] lg:gap-6">
        <div className="hidden lg:block">{grid}</div>
        {ready && p ? (
          <PuzzlePlayer puzzle={p} onSolved={() => markSolved(p.id)} onNext={() => step(1)} />
        ) : (
          <div className="min-h-0 flex-1 animate-pulse sk-lg bg-card-2 lg:h-[52vh]" />
        )}
      </div>
      <Sheet open={list} onClose={() => setList(false)} title="Puzzles">
        <p className="mb-3 text-sm text-ink-soft">
          Real positions from engine games. {solved.size} of {LIST.length} solved.
        </p>
        {grid}
      </Sheet>
    </div>
  );
}
