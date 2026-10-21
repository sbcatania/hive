"use client";

import { useMemo, useRef, useState } from "react";
import { hexPoints } from "./BugGlyph";
import { PieceTile, TileDefs } from "./PieceTile";
import type { BoardProps } from "./board-types";

const S = 40; // hex radius in SVG units
const SQ3 = Math.sqrt(3);

export const hexToPixel = (q: number, r: number) => [S * SQ3 * (q + r / 2), S * 1.5 * r] as const;
const levelOffset = (level: number) => [-level * S * 0.13, -level * S * 0.17] as const;

export default function Board2D({ state, selected, targets, hint, onPieceClick, onTargetClick, onBackgroundClick, theme, selectable }: BoardProps) {
  const style = theme === "tiles" ? "tiles" : "flat";
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
    const w = Math.max(maxX - minX + S * 3, minW);
    const h = Math.max(maxY - minY + S * 3, minH);
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
    // Draw lower levels first, then top-to-bottom so tile sides overlap correctly.
    items.sort((a, b) => a.p.level - b.p.level || a.y - b.y);
    return items;
  }, [cells]);

  function clientToSvgScale() {
    const svg = svgRef.current;
    if (!svg) return 1;
    const rect = svg.getBoundingClientRect();
    return Math.max(viewBox[2] / rect.width, viewBox[3] / rect.height);
  }

  function onWheel(e: React.WheelEvent) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const scale = clientToSvgScale();
    // Pointer position relative to the centre of the viewBox, in SVG units.
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
      const scale = clientToSvgScale();
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

  const selectedPiece = state.pieces.find((p) => p.name === selected);
  const lastFrom = state.lastMove?.from;
  const lastTo = state.lastMove?.to;
  const cx = viewBox[0] + viewBox[2] / 2;
  const cy = viewBox[1] + viewBox[3] / 2;

  return (
    <div className="relative h-full w-full select-none">
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
      >
        {style === "tiles" && <TileDefs />}
        <defs>
          <marker id="hint-arrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" fill="var(--hint)" />
          </marker>
        </defs>
        <g transform={`translate(${view.x} ${view.y}) translate(${cx} ${cy}) scale(${view.k}) translate(${-cx} ${-cy})`}>
          {lastFrom && (
            <polygon points={hexPoints(...hexToPixel(lastFrom[0], lastFrom[1]), S * 0.92)} fill="var(--last-move)" fillOpacity={0.18} stroke="var(--last-move)" strokeOpacity={0.6} strokeDasharray="6 5" strokeWidth={2.5} />
          )}

          {pieceItems.map(({ key, p, x, y, height, names }) => {
            const clickable = p.onTop && !!onPieceClick;
            const isSel = p.name === selected;
            const isLast = lastTo && p.onTop && p.q === lastTo[0] && p.r === lastTo[1];
            return (
              <g
                key={key}
                style={{ transform: `translate(${x}px, ${y}px)`, transition: "transform 260ms ease-out" }}
                className={clickable ? "cursor-pointer" : undefined}
                onClick={clickable ? guard(() => onPieceClick!(p.name)) : undefined}
              >
                <title>{names.length > 1 ? `Stack (bottom → top): ${names.join(", ")}` : p.name}</title>
                <PieceTile bug={p.bug} color={p.color} x={0} y={0} size={S} style={style} />
                {isLast && <polygon points={hexPoints(0, 0, S * 0.93)} fill="none" stroke="var(--last-move)" strokeWidth={3.5} />}
                {p.onTop && selectable.has(p.name) && !isSel && (
                  <polygon points={hexPoints(0, 0, S * 0.93)} fill="none" stroke="var(--movable)" strokeOpacity={0.55} strokeWidth={2} />
                )}
                {isSel && <polygon points={hexPoints(0, 0, S * 0.96)} fill="none" stroke="var(--selected)" strokeWidth={5} />}
                {p.onTop && height > 1 && (
                  <g transform={`translate(${S * 0.55} ${-S * 0.62})`}>
                    <circle r={S * 0.24} fill="var(--badge)" stroke="#fff" strokeWidth={2} />
                    <text textAnchor="middle" dy="0.36em" fontSize={S * 0.3} fontWeight={700} fill="#fff">
                      {height}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {targets.map((m) => {
            const [x, y] = hexToPixel(m.to[0], m.to[1]);
            const [ox, oy] = levelOffset(m.toLevel);
            const climb = m.toLevel > 0;
            return (
              <g key={m.notation} className="cursor-pointer" onClick={guard(() => onTargetClick?.(m))} transform={`translate(${x + ox} ${y + oy})`}>
                <polygon points={hexPoints(0, 0, S * 0.9)} fill="var(--target)" fillOpacity={climb ? 0.35 : 0.22} stroke="var(--target)" strokeWidth={3} strokeDasharray={climb ? "none" : "7 5"} />
                {selectedPiece || m.from === null ? <circle r={S * 0.16} fill="var(--target)" /> : null}
                {climb && (
                  <text textAnchor="middle" y={S * 0.55} fontSize={S * 0.32} fontWeight={700} fill="var(--target)">
                    ▲
                  </text>
                )}
              </g>
            );
          })}

          {hint && (
            <g pointerEvents="none">
              {hint.from ? (
                <line
                  x1={hexToPixel(hint.from[0], hint.from[1])[0]}
                  y1={hexToPixel(hint.from[0], hint.from[1])[1]}
                  x2={hexToPixel(hint.to[0], hint.to[1])[0]}
                  y2={hexToPixel(hint.to[0], hint.to[1])[1]}
                  stroke="var(--hint)"
                  strokeWidth={6}
                  strokeLinecap="round"
                  markerEnd="url(#hint-arrow)"
                  opacity={0.9}
                />
              ) : null}
              <polygon points={hexPoints(...hexToPixel(hint.to[0], hint.to[1]), S * 0.95)} fill="none" stroke="var(--hint)" strokeWidth={5} />
            </g>
          )}
        </g>
      </svg>
      {(view.x !== 0 || view.y !== 0 || view.k !== 1) && (
        <button className="btn-ghost absolute right-2 top-2 text-xs" onClick={() => setView({ x: 0, y: 0, k: 1 })}>
          Re-centre
        </button>
      )}
    </div>
  );
}
