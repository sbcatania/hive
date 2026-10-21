"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Board2D from "@/components/Board2D";
import { HandPanel } from "@/components/HandPanel";
import { AiClient } from "@/lib/ai-client";
import { errorMessage, loadEngine, withEngine } from "@/lib/engine";
import { colorName, normalizeRules, type ColorCode, type MoveView, type StateView } from "@/lib/engine-types";
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
  const [theme, setTheme] = useState<ThemeId>("bakelite");
  const ai = useRef<AiClient | null>(null);

  useEffect(() => {
    setTheme(loadTheme() === "3d" ? "bakelite" : loadTheme());
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
    <div className="space-y-3">
      <div className={`card flex items-center justify-between gap-3 !px-4 !py-3 ${phase === "solved" ? "!border-move !bg-[color-mix(in_oklab,var(--move)_10%,var(--card))]" : phase === "wrong" ? "!border-danger !bg-[color-mix(in_oklab,var(--danger)_9%,var(--card))]" : ""}`}>
        <div>
          <div className="font-display text-xl font-semibold">
            {colorName(solver)} to play and win in {puzzle.kind === "win1" ? "one" : "two"}
          </div>
          <div className="text-sm text-ink-soft">{message ?? (puzzle.kind === "win1" ? "Find the move that completes the surround." : "Find a move after which every defence loses.")}</div>
        </div>
        {phase === "solved" && (
          <button className="btn shrink-0" onClick={onNext}>
            Next puzzle
            <Icon name="next" size={18} />
          </button>
        )}
      </div>
      <div className="card relative h-[52vh] min-h-80 overflow-hidden !p-0">
        <Board2D state={state} selected={selected} targets={targets} theme={theme} selectable={selectable} onPieceClick={onPieceClick} onTargetClick={play} onBackgroundClick={() => setSelected(null)} hideLastMove={moves.length === puzzle.moves.length} />
      </div>
      <HandPanel color={solver} hand={state.hands[solver === "w" ? 0 : 1]} selected={selected} placeable={placeable} onSelect={(n) => setSelected(n === selected ? null : n)} />
      <div className="flex gap-2">
        <button className="btn-ghost" onClick={() => (setMoves(puzzle.moves), setPhase("solve"), setMessage(null))}>
          <Icon name="refresh" size={16} />
          Restart
        </button>
        <button
          className="btn-ghost"
          onClick={() => setMessage(`Hint: the key piece is your ${puzzle.solutions[0].split(" ")[0]}.`)}
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
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="specimen-label">Field exercises</div>
      <h1 className="font-display text-4xl font-semibold">Puzzles</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Real positions from engine games, checked by the engine. {solved.size} of {LIST.length} solved. New to the rules? <Link href="/learn" className="underline">Read the field guide</Link>.
      </p>
      <div className="mt-6 grid gap-6 lg:grid-cols-[16rem_1fr]">
        <ol className="grid grid-cols-4 gap-2 self-start sm:grid-cols-8 lg:grid-cols-3">
          {LIST.map((q, i) => (
            <li key={q.id}>
              <button
                onClick={() => setCurrent(i)}
                className={`flex aspect-square w-full flex-col items-center justify-center sk border text-sm transition ${i === current ? "border-accent bg-accent-soft/60 ring-2 ring-accent/30" : "border-line bg-card hover:border-line-strong"}`}
                title={`${q.kind === "win1" ? "Win in 1" : "Win in 2"} · ${q.rules}`}
              >
                <span className="font-display text-lg font-semibold">{i + 1}</span>
                <span className="text-[10px] text-muted">{q.kind === "win1" ? "in 1" : "in 2"}</span>
                {solved.has(q.id) && <Icon name="check" size={16} className="text-move" title="Solved" />}
              </button>
            </li>
          ))}
        </ol>
        {ready && p ? (
          <PuzzlePlayer puzzle={p} onSolved={() => markSolved(p.id)} onNext={() => setCurrent((c) => (c + 1) % LIST.length)} />
        ) : (
          <div className="h-[52vh] animate-pulse sk-lg bg-card-2" />
        )}
      </div>
    </div>
  );
}
