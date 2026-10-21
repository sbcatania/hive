"use client";

import { useMemo, useRef, useState } from "react";
import { hexPoints } from "./BugGlyph";
import { PieceTile, TileDefs, type TileStyle } from "./PieceTile";
import type { BoardProps } from "./board-types";
import type { MoveView } from "@/lib/engine-types";

const S = 40; // hex radius in SVG units
const SQ3 = Math.sqrt(3);

export const hexToPixel = (q: number, r: number) => [S * SQ3 * (q + r / 2), S * 1.5 * r] as const;
const levelOffset = (level: number) => [-level * S * 0.12, -level * S * 0.2] as const;

function Target({ m, kind, onClick }: { m: MoveView; kind: "legal" | "preview"; onClick?: (e: React.MouseEvent) => void }) {
  const [x, y] = hexToPixel(m.to[0], m.to[1]);
  const [ox, oy] = levelOffset(m.toLevel);
  const climb = m.toLevel > 0;
  const c = kind === "legal" ? "var(--leaf)" : "var(--coral)";
  return (
    <g
      data-move={m.notation}
      className={kind === "legal" ? "firefly cursor-pointer" : undefined}
      onClick={onClick}
      transform={`translate(${x + ox} ${y + oy})`}
      pointerEvents={kind === "legal" ? undefined : "none"}
    >
      <polygon
        points={hexPoints(0, 0, S * 0.88)}
        fill={c}
        fillOpacity={kind === "legal" ? (climb ? 0.34 : 0.22) : 0.06}
        stroke={c}
        strokeWidth={kind === "legal" ? 3 : 2.5}
        strokeDasharray={kind === "legal" ? undefined : "5 6"}
      />
      {kind === "legal" ? <circle r={S * 0.15} fill={c} /> : <circle r={S * 0.13} fill="none" stroke={c} strokeWidth={2.5} />}
      {climb && (
        <text textAnchor="middle" y={S * 0.58} fontSize={S * 0.3} fontWeight={700} fill={c}>
          ▲
        </text>
      )}
    </g>
  );
}

export default function Board2D({ state, selected, targets, previewTargets = [], hint, onPieceClick, onTargetClick, onBackgroundClick, theme, selectable, hideLastMove }: BoardProps) {
  const style: TileStyle = theme === "field" ? "field" : theme === "clean" ? "clean" : "bakelite";
  const svgRef = useRef<SVGSVGElement>(null);
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const drag = useRef<{ id: number; x: number; y: number; vx: number; vy: number; moved: boolean } | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; k: number } | null>(null);
  const suppressClick = useRef(false);

  const { cells, viewBox } = useMemo(() => {
    const cells = new Map<string, typeof state.pieces>();
    for (const p of state.pieces) {
      const key = `${p.q},${p.r}`;
      if (!cells.has(key)) cells.set(key, []);
      cells.get(key)!.push(p);
    }
    for (const list of cells.values()) list.sort((a, b) => a.level - b.level);
    const pts: [number, number][] = [];
    for (const p of state.pieces) pts.push([p.q, p.r]);
    for (const m of state.legalMoves) pts.push(m.to);
    if (pts.length === 0) pts.push([0, 0]);
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    for (const [q, r] of pts) {
      const [x, y] = hexToPixel(q, r);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    const minW = S * SQ3 * 7;
    const minH = S * 1.5 * 6;
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const w = Math.max(maxX - minX + S * 3.2, minW);
    const h = Math.max(maxY - minY + S * 3.2, minH);
    return { cells, viewBox: [cx - w / 2, cy - h / 2, w, h] as const };
  }, [state]);

  const pieceItems = useMemo(() => {
    const items: { key: string; p: (typeof state.pieces)[number]; x: number; y: number; height: number; names: string[] }[] = [];
    for (const list of cells.values()) {
      const names = list.map((p) => p.name);
      for (const p of list) {
        const [bx, by] = hexToPixel(p.q, p.r);
        const [ox, oy] = levelOffset(p.level);
        items.push({ key: p.name, p, x: bx + ox, y: by + oy, height: list.length, names });
      }
    }
    items.sort((a, b) => a.p.level - b.p.level || a.y - b.y);
    return items;
  }, [cells]);

  function svgScale() {
    const svg = svgRef.current;
    if (!svg) return 1;
    const rect = svg.getBoundingClientRect();
    return Math.max(viewBox[2] / rect.width, viewBox[3] / rect.height);
  }

  function onWheel(e: React.WheelEvent) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const scale = svgScale();
    const px = (e.clientX - rect.left - rect.width / 2) * scale;
    const py = (e.clientY - rect.top - rect.height / 2) * scale;
    const factor = Math.exp(-e.deltaY * 0.0015);
    setView((v) => {
      const k = Math.min(4, Math.max(0.3, v.k * factor));
      const f = k / v.k;
      return { k, x: px - (px - v.x) * f, y: py - (py - v.y) * f };
    });
  }

  function onPointerDown(e: React.PointerEvent) {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), k: view.k };
      drag.current = null;
      return;
    }
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, moved: false };
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.current && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const k = Math.min(4, Math.max(0.3, (pinch.current.k * d) / pinch.current.dist));
      setView((v) => ({ ...v, k }));
      suppressClick.current = true;
      return;
    }
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) > 6) {
      d.moved = true;
      svgRef.current?.setPointerCapture(e.pointerId);
    }
    if (d.moved) {
      const scale = svgScale();
      setView((v) => ({ ...v, x: d.vx + dx * scale, y: d.vy + dy * scale }));
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (drag.current?.id === e.pointerId) {
      if (drag.current.moved) suppressClick.current = true;
      drag.current = null;
    }
  }

  function guard(fn: () => void) {
    return (e: React.MouseEvent) => {
      e.stopPropagation();
      if (suppressClick.current) {
        suppressClick.current = false;
        return;
      }
      fn();
    };
  }

  const lastFrom = hideLastMove ? null : state.lastMove?.from;
  const lastTo = hideLastMove ? null : state.lastMove?.to;
  const cx = viewBox[0] + viewBox[2] / 2;
  const cy = viewBox[1] + viewBox[3] / 2;
  const legalCells = new Set(targets.map((m) => `${m.to[0]},${m.to[1]}`));
  const preview = previewTargets.filter((m) => !legalCells.has(`${m.to[0]},${m.to[1]}`));

  return (
    <div className={`relative h-full w-full select-none ${style === "field" ? "board-paper" : "board-surface"}`}>
      <svg
        ref={svgRef}
        className="h-full w-full touch-none"
        viewBox={viewBox.join(" ")}
        preserveAspectRatio="xMidYMid meet"
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={guard(() => onBackgroundClick?.())}
        role="application"
        aria-label="Hive board"
      >
        <TileDefs />
        <defs>
          <marker id="hint-arrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" fill="var(--violet)" />
          </marker>
        </defs>
        <g transform={`translate(${view.x} ${view.y}) translate(${cx} ${cy}) scale(${view.k}) translate(${-cx} ${-cy})`}>
          {lastFrom && (
            <polygon
              points={hexPoints(...hexToPixel(lastFrom[0], lastFrom[1]), S * 0.9)}
              fill="var(--accent)"
              fillOpacity={0.12}
              stroke="var(--accent)"
              strokeOpacity={0.7}
              strokeDasharray="3 6"
              strokeLinecap="round"
              strokeWidth={3}
            />
          )}

          {pieceItems.map(({ key, p, x, y, height, names }) => {
            const clickable = p.onTop && !!onPieceClick;
            const isSel = p.name === selected;
            const isLast = lastTo && p.onTop && p.q === lastTo[0] && p.r === lastTo[1];
            return (
              <g
                key={key}
                style={{ transform: `translate(${x}px, ${y}px)`, transition: "transform 280ms cubic-bezier(.2,.8,.3,1)" }}
                className={clickable ? "cursor-pointer" : undefined}
                onClick={clickable ? guard(() => onPieceClick!(p.name)) : undefined}
              >
                <title>{names.length > 1 ? `Stack (bottom → top): ${names.join(", ")}` : p.name}</title>
                <PieceTile bug={p.bug} color={p.color} x={0} y={0} size={S} style={style} />
                {isLast && <polygon points={hexPoints(0, 0, S * 0.98)} fill="none" stroke="var(--accent)" strokeWidth={4} />}
                {p.onTop && selectable.has(p.name) && !isSel && (
                  <polygon points={hexPoints(0, 0, S * 0.92)} fill="none" stroke="var(--leaf)" strokeOpacity={0.55} strokeWidth={2} />
                )}
                {isSel && <polygon points={hexPoints(0, 0, S * 1.02)} fill="none" stroke="var(--sky)" strokeWidth={5} />}
                {p.onTop && height > 1 && (
                  <g transform={`translate(${S * 0.58} ${-S * 0.62})`}>
                    <circle r={S * 0.25} fill="var(--accent)" stroke="var(--paper)" strokeWidth={2.5} />
                    <text textAnchor="middle" dy="0.36em" fontSize={S * 0.3} fontWeight={800} fill="var(--accent-ink)">
                      {height}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {preview.map((m) => (
            <Target key={"p" + m.notation} m={m} kind="preview" />
          ))}
          {targets.map((m) => (
            <Target key={m.notation} m={m} kind="legal" onClick={guard(() => onTargetClick?.(m))} />
          ))}

          {hint && (
            <g pointerEvents="none">
              {hint.from && (
                <line
                  x1={hexToPixel(hint.from[0], hint.from[1])[0]}
                  y1={hexToPixel(hint.from[0], hint.from[1])[1]}
                  x2={hexToPixel(hint.to[0], hint.to[1])[0]}
                  y2={hexToPixel(hint.to[0], hint.to[1])[1]}
                  stroke="var(--violet)"
                  strokeWidth={6}
                  strokeLinecap="round"
                  markerEnd="url(#hint-arrow)"
                  opacity={0.9}
                />
              )}
              <polygon points={hexPoints(...hexToPixel(hint.to[0], hint.to[1]), S * 0.96)} fill="none" stroke="var(--violet)" strokeWidth={5} />
            </g>
          )}
        </g>
      </svg>
      {(view.x !== 0 || view.y !== 0 || view.k !== 1) && (
        <button className="btn-ghost absolute right-2 bottom-2" onClick={() => setView({ x: 0, y: 0, k: 1 })}>
          Re-centre
        </button>
      )}
    </div>
  );
}
