"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import Board2D from "./Board2D";
import { HandPanel } from "./HandPanel";
import { MoveList } from "./MoveList";
import { Nameplate } from "./Nameplate";
import { ThemePicker } from "./ThemePicker";
import { Sheet } from "./Sheet";
import { Icon, type IconName } from "./Icon";
import { BUG_NAMES, colorName, type BugLetter, type ColorCode, type MoveView, type PreviewView, type StateView } from "@/lib/engine-types";
import type { ThemeId } from "@/lib/themes";
import { useAppScreen } from "@/lib/app-screen";

const Board3D = dynamic(() => import("./Board3D"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-sm text-muted">Setting the table…</div>,
});

/** A game control. Shown as an icon bar under the board on phones and as labelled buttons in the sidebar. */
export interface GameAction {
  id: string;
  icon: IconName;
  label: string;
  /** Shorter label for the phone action bar. */
  short?: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  busy?: boolean;
  /** On phones, put this in the "More" sheet instead of the action bar. */
  menu?: boolean;
}

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
  actions?: GameAction[];
  /** Small print under the move list (rules, clock, export). */
  footer?: React.ReactNode;
  /** Things that need an answer now (offers, invites, errors): above the action bar on phones. */
  notice?: React.ReactNode;
}

function describePiece(name: string) {
  const color: ColorCode = name[0] === "w" ? "w" : "b";
  const bug = name[1] as BugLetter;
  return { color, bug, label: `${colorName(color)} ${BUG_NAMES[bug]}` };
}

export function GameView({ state, theme, onThemeChange, canMove, onPlay, getPreview, players, bottom, hint, status, sidebar, analysis, overlay, actions = [], footer, notice }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [sheet, setSheet] = useState(false);
  useAppScreen();
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
    <div className="flex min-w-0 shrink-0 items-center gap-1.5 lg:block lg:space-y-1.5">
      <div className="w-[6.1rem] shrink-0 lg:w-auto">
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
      </div>
      <HandPanel
        className="min-w-0 flex-1 !mx-0 lg:!-mx-1"
        color={c}
        hand={state.hands[c === "w" ? 0 : 1]}
        selected={selected}
        placeable={state.toMove === c ? placeable : new Set()}
        onSelect={over ? undefined : select}
        small={c === top}
      />
      {players[c].clock && <div className="shrink-0 lg:hidden">{players[c].clock}</div>}
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
    onDragChange: setDragging,
  };

  const sel = selected ? describePiece(selected) : null;
  const stack = selected ? state.pieces.filter((p) => p.name === selected) : [];
  const inHand = selected && stack.length === 0;
  const owner = sel ? colorName(sel.color) : "";

  const barActions = actions.filter((a) => !a.menu);
  const menuActions = actions.filter((a) => a.menu);
  const details = (
    <>
      {analysis}
      {sidebar}
      <div>
        <span className="label">Moves</span>
        <MoveList history={state.history} />
      </div>
      {footer}
      <div className="flex flex-wrap items-center gap-2">
        <span className="label mb-0">Board</span>
        <ThemePicker value={theme} onChange={onThemeChange} />
      </div>
    </>
  );
  const barButton = (key: string, icon: IconName, label: string, onClick: () => void, opts: { disabled?: boolean; active?: boolean; busy?: boolean } = {}) => (
    <button
      key={key}
      onClick={onClick}
      disabled={opts.disabled}
      aria-pressed={opts.active}
      className={`flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[0.72rem] leading-none font-semibold transition select-none active:scale-95 disabled:opacity-35 ${opts.active ? "text-ink" : "text-ink-soft"}`}
    >
      <span className={`pencil grid h-8 w-12 place-items-center ${opts.active ? "pencil-honey" : ""}`}>
        <Icon name={icon} size={19} className={opts.busy ? "pulse-ink" : undefined} />
      </span>
      <span className="truncate">{label}</span>
    </button>
  );

  return (
    <div
      className="mx-auto flex h-[calc(100dvh-var(--header-h))] w-full max-w-[1400px] flex-col gap-1.5 overflow-hidden px-2 pt-1.5 select-none sm:gap-2 sm:px-3 lg:flex-row lg:gap-3 lg:p-3"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 6px)" }}
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-1.5 sm:gap-2">
        {seat(top)}
        <div className="card relative min-h-0 flex-1 !p-0">
          <div className="absolute inset-[3px] overflow-hidden" style={{ borderRadius: "11px 3px 13px 4px / 4px 13px 3px 11px" }}>
            {theme === "3d" ? <Board3D {...boardProps} /> : <Board2D {...boardProps} />}
          </div>
          <div className={`pencil pointer-events-none absolute top-2 left-2 -rotate-1 px-2.5 py-0.5 font-hand text-lg leading-snug text-ink ${analysis ? "max-w-[52%] lg:max-w-[75%]" : "max-w-[75%]"}`}>
            {status}
          </div>
          {analysis && <div className="pointer-events-none absolute top-2 right-2 w-[44%] lg:hidden">{analysis}</div>}
          {sel && (
            <div className={`rise pointer-events-none absolute right-2 bottom-2 left-2 z-[5] sm:right-auto sm:max-w-sm`}>
              <div className={`pointer-events-auto flex items-start gap-2 transition-opacity ${dragging ? "opacity-0" : ""} pencil pencil-strong py-1.5 pr-1 pl-3 text-sm sm:py-2`}>
                <div className="min-w-0 flex-1 py-0.5">
                  <div className="font-semibold">
                    {sel.label} <span className="font-mono text-xs text-muted">{selected}</span>
                    {inHand && <span className="ml-1 text-xs text-muted">(in hand)</span>}
                  </div>
                  <ul className="mt-1 space-y-0.5 text-[0.82rem] text-ink-soft">
                    {targets.length > 0 && (
                      <li className="flex items-center gap-1.5">
                        <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-move" />
                        {targets.length} legal {inHand ? "placement" : "move"}
                        {targets.length === 1 ? "" : "s"}
                        {sel.color !== state.toMove ? " for your Pillbug to throw it" : ""}
                        <span className="text-muted">· tap one, or drag the piece</span>
                      </li>
                    )}
                    {previewTargets.length > 0 && (
                      <li className="flex items-center gap-1.5">
                        <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full border-2 border-dashed border-threat" />
                        {preview?.legal ? `Can reach ${previewTargets.length} cell${previewTargets.length === 1 ? "" : "s"} this turn` : `Could reach ${previewTargets.length} cell${previewTargets.length === 1 ? "" : "s"} on ${owner}'s next turn`}
                      </li>
                    )}
                    {preview?.reason && targets.length === 0 && <li className="text-ink">{preview.reason}</li>}
                  </ul>
                </div>
                <button className="grid h-10 w-10 shrink-0 place-items-center text-muted hover:text-ink" onClick={() => setSelected(null)} aria-label="Close">
                  <Icon name="close" />
                </button>
              </div>
            </div>
          )}
          {overlay}
        </div>
        {notice && <div className="max-h-[35%] shrink-0 overflow-y-auto empty:hidden lg:hidden">{notice}</div>}
        <div className="flex shrink-0 items-stretch justify-around gap-1 lg:hidden" role="toolbar" aria-label="Game controls">
          {barActions.map((a) => barButton(a.id, a.icon, a.short ?? a.label, a.onClick, a))}
          {barButton("more", "more", "More", () => setSheet(true))}
        </div>
        {seat(bottom)}
      </div>
      <aside className="hidden w-[22rem] shrink-0 flex-col gap-3 overflow-y-auto pr-1 select-text lg:flex">
        {actions.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {actions.map((a) => (
              <button key={a.id} className="btn-secondary !justify-start" onClick={a.onClick} disabled={a.disabled} aria-pressed={a.active}>
                <Icon name={a.icon} size={18} className={a.busy ? "pulse-ink" : undefined} />
                {a.label}
              </button>
            ))}
          </div>
        )}
        {notice}
        {details}
      </aside>
      <Sheet open={sheet} onClose={() => setSheet(false)} title="Game">
        <div className="space-y-4 select-text">
          {menuActions.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {menuActions.map((a) => (
                <button
                  key={a.id}
                  className="btn-secondary !justify-start"
                  disabled={a.disabled}
                  aria-pressed={a.active}
                  onClick={() => {
                    setSheet(false);
                    a.onClick();
                  }}
                >
                  <Icon name={a.icon} size={18} />
                  {a.label}
                </button>
              ))}
            </div>
          )}
          {details}
        </div>
      </Sheet>
    </div>
  );
}
