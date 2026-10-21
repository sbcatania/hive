"use client";

import { useEffect, useState } from "react";
import Board2D from "./Board2D";
import { Engine, loadEngine } from "@/lib/engine";
import type { StateView } from "@/lib/engine-types";

/** A small live board showing where one piece can move. Click a green cell to try it. */
export function BugDemo({ gameString, focus }: { gameString: string; focus: string }) {
  const [state, setState] = useState<StateView | null>(null);
  const [initial, setInitial] = useState<StateView | null>(null);
  const [moved, setMoved] = useState(false);

  useEffect(() => {
    let alive = true;
    loadEngine().then(() => {
      if (!alive) return;
      const e = Engine.fromGameString(gameString, false);
      const s = e.state();
      e.free();
      setState(s);
      setInitial(s);
    });
    return () => {
      alive = false;
    };
  }, [gameString]);

  if (!state) return <div className="h-64 animate-pulse rounded-xl bg-black/5" />;

  const targets = moved ? [] : state.legalMoves.filter((m) => m.piece === focus);

  function tryMove(notation: string) {
    const e = Engine.fromGameString(gameString, false);
    e.play(notation);
    setState(e.state());
    e.free();
    setMoved(true);
  }

  return (
    <div className="board-surface relative h-64 overflow-hidden rounded-xl border border-[var(--line)] sm:h-72">
      <Board2D
        state={{ ...state, lastMove: moved ? state.lastMove : null }}
        selected={moved ? null : focus}
        targets={targets}
        theme="flat"
        selectable={new Set()}
        onTargetClick={(m) => tryMove(m.notation)}
      />
      <div className="pointer-events-none absolute left-2 top-2 rounded-md bg-black/55 px-2 py-1 text-xs text-white">
        {moved ? "Moved!" : `${targets.length} possible move${targets.length === 1 ? "" : "s"} — click one`}
      </div>
      {moved && (
        <button
          className="btn-ghost absolute bottom-2 right-2 text-xs"
          onClick={() => {
            setState(initial);
            setMoved(false);
          }}
        >
          Reset
        </button>
      )}
    </div>
  );
}
