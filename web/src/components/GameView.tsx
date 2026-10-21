"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import Board2D from "./Board2D";
import { HandPanel } from "./HandPanel";
import { MoveList } from "./MoveList";
import { Nameplate } from "./Nameplate";
import { ThemePicker } from "./ThemePicker";
import { BUG_NAMES, colorName, type BugLetter, type ColorCode, type MoveView, type PreviewView, type StateView } from "@/lib/engine-types";
import type { ThemeId } from "@/lib/themes";

const Board3D = dynamic(() => import("./Board3D"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-sm text-muted">Setting the table…</div>,
});

export interface PlayerInfo {
  name: string;
  sub?: React.ReactNode;
  bug?: BugLetter;
  clock?: React.ReactNode;
  thinking?: boolean;
}

interface Props {
  state: StateView;
  theme: ThemeId;
  onThemeChange: (t: ThemeId) => void;
  /** Whether the local user may move for the side to move right now. */
  canMove: boolean;
  onPlay: (notation: string) => void;
  /** Legal moves / next-turn preview / explanation for any piece. */
  getPreview: (piece: string) => PreviewView;
  players: Record<ColorCode, PlayerInfo>;
  /** Which player sits at the bottom (the local player). */
  bottom: ColorCode;
  hint?: string | null;
  status: React.ReactNode;
  sidebar?: React.ReactNode;
  analysis?: React.ReactNode;
  overlay?: React.ReactNode;
}

function describePiece(name: string) {
  const color: ColorCode = name[0] === "w" ? "w" : "b";
  const bug = name[1] as BugLetter;
  return { color, bug, label: `${colorName(color)} ${BUG_NAMES[bug]}` };
}

export function GameView({ state, theme, onThemeChange, canMove, onPlay, getPreview, players, bottom, hint, status, sidebar, analysis, overlay }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => setSelected(null), [state.ply, canMove]);

  const legalByPiece = useMemo(() => {
    const m = new Map<string, MoveView[]>();
    if (!canMove) return m;
    for (const mv of state.legalMoves) {
      if (!m.has(mv.piece)) m.set(mv.piece, []);
      m.get(mv.piece)!.push(mv);
    }
    return m;
  }, [state, canMove]);

  const over = state.status === "WhiteWins" || state.status === "BlackWins" || state.status === "Draw";
  const preview = useMemo<PreviewView | null>(() => (selected && !over ? getPreview(selected) : null), [selected, getPreview, over, state.ply]); // eslint-disable-line react-hooks/exhaustive-deps

  const targets = selected ? (legalByPiece.get(selected) ?? []) : [];
  const previewTargets = preview && !(preview.legal && canMove) ? preview.moves : [];

  const selectable = useMemo(() => {
    const s = new Set<string>();
    for (const [name, moves] of legalByPiece) if (moves.some((m) => m.from !== null)) s.add(name);
    return s;
  }, [legalByPiece]);
  const placeable = useMemo(() => {
    const s = new Set<string>();
    for (const [name, moves] of legalByPiece) if (moves.some((m) => m.from === null)) s.add(name);
    return s;
  }, [legalByPiece]);
  const hintMove = hint ? (state.legalMoves.find((m) => m.notation === hint) ?? null) : null;

  function select(name: string) {
    if (selected && name !== selected) {
      // Clicking the top of a stack the selected piece can climb onto.
      const p = state.pieces.find((x) => x.name === name);
      const climb = p && targets.find((m) => m.to[0] === p.q && m.to[1] === p.r);
      if (climb) {
        onPlay(climb.notation);
        return;
      }
    }
    setSelected(name === selected ? null : name);
  }

  const need = state.rules.surround;
  const top: ColorCode = bottom === "w" ? "b" : "w";
  const seat = (c: ColorCode) => (
    <div className="space-y-1.5">
      <Nameplate
        color={c}
        name={players[c].name}
        sub={players[c].sub}
        bug={players[c].bug}
        active={!over && state.toMove === c}
        thinking={players[c].thinking}
        queenCount={state.queenNeighbors[c === "w" ? 0 : 1]}
        need={need}
        clock={players[c].clock}
      />
      <HandPanel color={c} hand={state.hands[c === "w" ? 0 : 1]} selected={selected} placeable={state.toMove === c ? placeable : new Set()} onSelect={over ? undefined : select} />
    </div>
  );

  const boardProps = {
    state,
    selected,
    targets,
    previewTargets,
    hint: hintMove,
    theme,
    selectable,
    onPieceClick: over ? undefined : select,
    onTargetClick: (m: MoveView) => onPlay(m.notation),
    onBackgroundClick: () => setSelected(null),
  };

  const sel = selected ? describePiece(selected) : null;
  const stack = selected ? state.pieces.filter((p) => p.name === selected) : [];
  const inHand = selected && stack.length === 0;
  const owner = sel ? colorName(sel.color) : "";

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-3 p-3 lg:h-[calc(100dvh-3.5rem)] lg:flex-row">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
        {seat(top)}
        <div className="relative h-[56vh] min-h-[320px] overflow-hidden rounded-2xl border border-line shadow-[var(--shadow)] lg:h-auto lg:min-h-0 lg:flex-1">
          {theme === "3d" ? <Board3D {...boardProps} /> : <Board2D {...boardProps} />}
          <div className="pointer-events-none absolute top-2 left-2 max-w-[70%] rounded-lg bg-ink/80 px-2.5 py-1 text-xs font-medium text-paper backdrop-blur">{status}</div>
          {sel && (
            <div className="rise absolute right-2 bottom-2 left-2 sm:right-auto sm:max-w-sm">
              <div className="flex items-start gap-3 rounded-xl border border-line bg-card/95 p-3 text-sm shadow-lg backdrop-blur">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">
                    {sel.label} <span className="font-mono text-xs text-muted">{selected}</span>
                    {inHand && <span className="ml-1 text-xs text-muted">(in hand)</span>}
                  </div>
                  <ul className="mt-1 space-y-0.5 text-xs text-ink-soft">
                    {targets.length > 0 && (
                      <li className="flex items-center gap-1.5">
                        <span className="inline-block h-2.5 w-2.5 rounded-full bg-leaf" />
                        {targets.length} legal {inHand ? "placement" : "move"}
                        {targets.length === 1 ? "" : "s"}
                        {sel.color !== state.toMove ? " for your Pillbug to throw it" : ""}
                      </li>
                    )}
                    {previewTargets.length > 0 && (
                      <li className="flex items-center gap-1.5">
                        <span className="inline-block h-2.5 w-2.5 rounded-full border-2 border-dashed border-coral" />
                        {preview?.legal ? `Can reach ${previewTargets.length} cell${previewTargets.length === 1 ? "" : "s"} this turn` : `Could reach ${previewTargets.length} cell${previewTargets.length === 1 ? "" : "s"} on ${owner}'s next turn`}
                      </li>
                    )}
                    {preview?.reason && targets.length === 0 && <li className="text-ink">{preview.reason}</li>}
                  </ul>
                </div>
                <button className="text-muted hover:text-ink" onClick={() => setSelected(null)} aria-label="Close">
                  ✕
                </button>
              </div>
            </div>
          )}
          {overlay}
        </div>
        {seat(bottom)}
      </div>
      <aside className="flex w-full shrink-0 flex-col gap-3 lg:w-[22rem] lg:overflow-y-auto">
        <div className="flex items-center justify-between gap-2">
          <span className="label mb-0">Board</span>
          <ThemePicker value={theme} onChange={onThemeChange} />
        </div>
        {analysis}
        {sidebar}
        <div>
          <span className="label">Field notes</span>
          <MoveList history={state.history} />
        </div>
      </aside>
    </div>
  );
}
