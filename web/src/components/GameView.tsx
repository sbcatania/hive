"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import Board2D from "./Board2D";
import { HandPanel } from "./HandPanel";
import { MoveList } from "./MoveList";
import { ThemePicker } from "./ThemePicker";
import type { ColorCode, MoveView, StateView } from "@/lib/engine-types";
import type { ThemeId } from "@/lib/themes";

const Board3D = dynamic(() => import("./Board3D"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-sm text-neutral-500">Loading 3D board…</div>,
});

interface Props {
  state: StateView;
  theme: ThemeId;
  onThemeChange: (t: ThemeId) => void;
  /** Whether the local user may move for the side to move right now. */
  canMove: boolean;
  onPlay: (notation: string) => void;
  labels: Record<ColorCode, React.ReactNode>;
  clocks?: Partial<Record<ColorCode, React.ReactNode>>;
  /** Which player's hand is shown at the bottom (the local player). */
  bottom: ColorCode;
  hint?: string | null;
  status: React.ReactNode;
  sidebar?: React.ReactNode;
  analysis?: React.ReactNode;
}

export function GameView({ state, theme, onThemeChange, canMove, onPlay, labels, clocks, bottom, hint, status, sidebar, analysis }: Props) {
  const [selected, setSelected] = useState<string | null>(null);

  const byPiece = useMemo(() => {
    const m = new Map<string, MoveView[]>();
    if (!canMove) return m;
    for (const mv of state.legalMoves) {
      if (!m.has(mv.piece)) m.set(mv.piece, []);
      m.get(mv.piece)!.push(mv);
    }
    return m;
  }, [state, canMove]);

  useEffect(() => setSelected(null), [state.ply, canMove]);

  const targets = selected ? (byPiece.get(selected) ?? []) : [];
  const selectable = useMemo(() => {
    const s = new Set<string>();
    for (const [name, moves] of byPiece) if (moves.some((m) => m.from !== null)) s.add(name);
    return s;
  }, [byPiece]);
  const placeable = useMemo(() => {
    const s = new Set<string>();
    for (const [name, moves] of byPiece) if (moves.some((m) => m.from === null)) s.add(name);
    return s;
  }, [byPiece]);
  const hintMove = hint ? (state.legalMoves.find((m) => m.notation === hint) ?? null) : null;

  function onPieceClick(name: string) {
    if (selected) {
      // Clicking the top of a stack the selected piece can climb onto.
      const p = state.pieces.find((x) => x.name === name);
      const climb = p && targets.find((m) => m.to[0] === p.q && m.to[1] === p.r);
      if (climb) {
        onPlay(climb.notation);
        return;
      }
    }
    setSelected(byPiece.has(name) && name !== selected ? name : null);
  }

  const top: ColorCode = bottom === "w" ? "b" : "w";
  const hand = (c: ColorCode) => (
    <HandPanel
      color={c}
      hand={state.hands[c === "w" ? 0 : 1]}
      label={labels[c]}
      right={clocks?.[c]}
      active={state.toMove === c && (state.status === "InProgress" || state.status === "NotStarted")}
      selected={selected}
      placeable={state.toMove === c ? placeable : new Set()}
      onSelect={(n) => setSelected(n === selected ? null : n)}
    />
  );

  const boardProps = {
    state,
    selected,
    targets,
    hint: hintMove,
    theme,
    selectable,
    onPieceClick,
    onTargetClick: (m: MoveView) => onPlay(m.notation),
    onBackgroundClick: () => setSelected(null),
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 p-3 lg:h-[calc(100dvh-3.5rem)] lg:flex-row">
      <div className="flex min-h-0 flex-1 flex-col gap-2">
        {hand(top)}
        <div className="board-surface relative min-h-[46vh] flex-1 overflow-hidden rounded-xl border border-[var(--line)]">
          {theme === "3d" ? <Board3D {...boardProps} /> : <Board2D {...boardProps} />}
          <div className="pointer-events-none absolute left-2 top-2 rounded-md bg-black/55 px-2 py-1 text-xs text-white">{status}</div>
        </div>
        {hand(bottom)}
      </div>
      <aside className="flex w-full shrink-0 flex-col gap-3 lg:w-80">
        <div className="flex items-center justify-between">
          <span className="text-xs text-neutral-500">Board style</span>
          <ThemePicker value={theme} onChange={onThemeChange} />
        </div>
        {analysis}
        {sidebar}
        <div>
          <div className="mb-1 text-xs font-medium text-neutral-500">Moves</div>
          <MoveList history={state.history} />
        </div>
      </aside>
    </div>
  );
}
