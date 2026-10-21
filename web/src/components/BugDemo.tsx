"use client";

import { useEffect, useState } from "react";
import Board2D from "./Board2D";
import { Engine, loadEngine } from "@/lib/engine";
import type { PreviewView, StateView } from "@/lib/engine-types";
import type { ThemeId } from "@/lib/themes";
import { Icon } from "./Icon";

/** A small live board showing where one piece can move. Tap a blue-ringed cell to try it. */
export function BugDemo({ gameString, focus, theme = "field", height = "h-64 sm:h-72", caption }: { gameString: string; focus: string; theme?: ThemeId; height?: string; caption?: string }) {
  const [state, setState] = useState<StateView | null>(null);
  const [initial, setInitial] = useState<{ state: StateView; preview: PreviewView } | null>(null);
  const [moved, setMoved] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    loadEngine().then(() => {
      if (!alive) return;
      const e = Engine.fromGameString(gameString, false);
      const s = e.state();
      const p = e.preview(focus);
      e.free();
      setState(s);
      setInitial({ state: s, preview: p });
    });
    return () => {
      alive = false;
    };
  }, [gameString, focus]);

  if (!state || !initial) return <div className={`${height} animate-pulse sk-lg bg-card-2`} />;

  const preview = initial.preview;
  // Legal moves of the focus piece right now (including being thrown by a Pillbug).
  const legal = initial.state.legalMoves.filter((m) => m.piece === focus);
  const targets = moved ? [] : legal;
  const coral = moved || legal.length ? [] : preview.moves;

  function tryMove(notation: string) {
    const e = Engine.fromGameString(gameString, false);
    e.play(notation);
    setState(e.state());
    e.free();
    setMoved(notation);
  }

  return (
    <figure className="space-y-1.5">
      <div className={`relative ${height} overflow-hidden sk-lg border border-line`}>
        <Board2D state={state} selected={moved ? null : focus} targets={targets} previewTargets={coral} theme={theme} selectable={new Set()} onTargetClick={(m) => tryMove(m.notation)} hideLastMove={!moved} />
        <div className="pointer-events-none absolute top-2 left-2 sk bg-ink/80 px-2 py-1 text-xs font-medium text-paper">
          {moved ? `Played ${moved}` : legal.length ? `${legal.length} possible move${legal.length === 1 ? "" : "s"}: click one` : preview.moves.length ? `${preview.moves.length} cells next turn` : "No moves"}
        </div>
        {moved && (
          <button
            className="btn-ghost absolute right-2 bottom-2"
            onClick={() => {
              setState(initial.state);
              setMoved(null);
            }}
          >
            <Icon name="refresh" size={16} />
            Reset
          </button>
        )}
        {!moved && !legal.length && preview.reason && <div className="absolute right-2 bottom-2 left-2 note bg-card/95 !p-2 text-xs shadow">{preview.reason}</div>}
      </div>
      {caption && <figcaption className="text-xs text-muted italic">{caption}</figcaption>}
    </figure>
  );
}
