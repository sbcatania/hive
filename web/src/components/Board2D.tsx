"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { hexPoints } from "./BugGlyph";
import { PieceTile, sketchHexPath } from "./PieceTile";
import { haptic } from "@/lib/haptics";
import type { BoardProps } from "./board-types";
import type { MoveView, PieceView } from "@/lib/engine-types";

const S = 40; // hex radius in SVG units
const GHOST = S * 2.4; // the drag ghost's box, in SVG units
const SQ3 = Math.sqrt(3);

export const hexToPixel = (q: number, r: number) => [S * SQ3 * (q + r / 2), S * 1.5 * r] as const;
const levelOffset = (level: number) => [-level * S * 0.12, -level * S * 0.2] as const;

/** A loose pen loop, the way you'd circle a spot on a map: a smooth curve through
 * jittered points (quadratic segments between midpoints), overlapping at the end. */
function inkLoop(cx: number, cy: number, r: number, seed: number) {
  const n = 10;
  const pts: [number, number][] = [];
  for (let i = 0; i <= n + 2; i++) {
    const a = (i / n) * Math.PI * 2 + seed;
    const rr = r * (1 + 0.06 * Math.sin(i * 2.3 + seed * 3) + (i > n ? 0.07 : 0));
    pts.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a) * 0.96]);
  }
  const mid = (p: [number, number], q: [number, number]) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  const f = (v: number) => v.toFixed(1);
  const m0 = mid(pts[0], pts[1]);
  let d = `M${f(m0[0])} ${f(m0[1])}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const m = mid(pts[i], pts[i + 1]);
    d += ` Q${f(pts[i][0])} ${f(pts[i][1])} ${f(m[0])} ${f(m[1])}`;
  }
  return d;
}

const pieceSeed = (name: string) => [...name].reduce((h, c) => h * 31 + c.charCodeAt(0), 7) % 997;

function buzz(ms = 8) {
  haptic(ms > 10);
}

function Target({ m, kind }: { m: MoveView; kind: "legal" | "preview" }) {
  const [x, y] = hexToPixel(m.to[0], m.to[1]);
  const [ox, oy] = levelOffset(m.toLevel);
  const climb = m.toLevel > 0;
  const seed = (m.to[0] * 7 + m.to[1] * 13) % 6;
  if (kind === "preview") {
    return (
      <g transform={`translate(${x + ox} ${y + oy})`} pointerEvents="none">
        <path d={inkLoop(0, 0, S * 0.34, seed)} fill="none" stroke="var(--threat)" strokeWidth={2.4} strokeDasharray="2 5" strokeLinecap="round" />
      </g>
    );
  }
  return (
    <g data-move={m.notation} className="cursor-pointer" transform={`translate(${x + ox} ${y + oy})`}>
      {/* generous invisible hit area for fingers */}
      <polygon points={hexPoints(0, 0, S)} fill="transparent" />
      <path d={sketchHexPath(0, 0, S * 0.86, seed, 0.03)} fill="var(--move)" fillOpacity={climb ? 0.2 : 0.1} stroke="none" />
      <path d={inkLoop(0, 0, S * 0.36, seed)} fill="none" stroke="var(--move)" strokeWidth={3.2} strokeLinecap="round" />
      <circle r={S * 0.1} fill="var(--move)" />
      {climb && <path d={`M${-S * 0.2} ${S * 0.62} L0 ${S * 0.42} L${S * 0.2} ${S * 0.62}`} fill="none" stroke="var(--move)" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />}
    </g>
  );
}

type Gesture =
  | { kind: "idle" }
  | { kind: "press"; id: number; x: number; y: number; item: Element | null; vx: number; vy: number; touch: boolean }
  | { kind: "pan"; id: number; x: number; y: number; vx: number; vy: number }
  | { kind: "drag"; id: number; piece: string; lift: number }
  | { kind: "pinch"; d0: number; k0: number; mx0: number; my0: number; vx0: number; vy0: number };

export default function Board2D({ state, selected, targets, previewTargets = [], hint, onPieceClick, onTargetClick, onBackgroundClick, theme, selectable, hideLastMove, onDragChange, fixed }: BoardProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const layerRef = useRef<SVGGElement>(null);
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  // During a pan or pinch the layer transform is written straight to the DOM (no React
  // render per finger move); the state catches up when the gesture ends.
  const viewRef = useRef(view);
  const live = useRef(false);
  if (!live.current) viewRef.current = view;
  const gesture = useRef<Gesture>({ kind: "idle" });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  // The dragged tile, drawn in its own small SVG over the board so moving it never
  // repaints the board. `size` is its width in CSS pixels at the current zoom.
  const [ghost, setGhost] = useState<{ piece: PieceView; size: number } | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const lastTap = useRef(0);
  const [narrow, setNarrow] = useState(false);
  const targetsRef = useRef(targets);
  targetsRef.current = targets;

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const on = () => setNarrow(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  const { cells, viewBox } = useMemo(() => {
    const cells = new Map<string, PieceView[]>();
    for (const p of state.pieces) {
      const key = `${p.q},${p.r}`;
      if (!cells.has(key)) cells.set(key, []);
      cells.get(key)!.push(p);
    }
    for (const list of cells.values()) list.sort((a, b) => a.level - b.level);
    const pts: [number, number][] = [];
    for (const p of state.pieces) pts.push([p.q, p.r]);
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
    // On phones, start more zoomed in so pieces are big enough to tap.
    const minW = S * SQ3 * (narrow ? 4.6 : 7);
    const minH = S * 1.5 * (narrow ? 4.5 : 6);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    // Frame the hive plus one ring of cells: every legal move lands next to it.
    const w = Math.max(maxX - minX + S * (2 * SQ3 + 2), minW);
    const h = Math.max(maxY - minY + S * 5, minH);
    // Extra room above for the status note and below for the selection card, both of
    // which sit over the board's edges.
    const top = fixed ? 0 : S * 1.1;
    const bottom = fixed ? 0 : S * 0.9;
    return { cells, viewBox: [cx - w / 2, cy - h / 2 - top, w, h + top + bottom] as const };
  }, [state, narrow, fixed]);

  const pieceItems = useMemo(() => {
    const items: { p: PieceView; x: number; y: number; height: number; names: string[] }[] = [];
    for (const list of cells.values()) {
      const names = list.map((p) => p.name);
      for (const p of list) {
        const [bx, by] = hexToPixel(p.q, p.r);
        const [ox, oy] = levelOffset(p.level);
        items.push({ p, x: bx + ox, y: by + oy, height: list.length, names });
      }
    }
    items.sort((a, b) => a.p.level - b.p.level || a.y - b.y);
    return items;
  }, [cells]);

  const cx = viewBox[0] + viewBox[2] / 2;
  const cy = viewBox[1] + viewBox[3] / 2;

  /** SVG units per CSS pixel. Measured on the container, which (unlike the SVG during
   * a gesture) never carries a transform. */
  function svgScale() {
    const rect = boxRef.current?.getBoundingClientRect();
    if (!rect) return 1;
    return Math.max(viewBox[2] / rect.width, viewBox[3] / rect.height);
  }

  /** Client point -> board coordinates (inside the pan/zoom layer). */
  function toBoard(clientX: number, clientY: number) {
    const layer = layerRef.current;
    const ctm = layer?.getScreenCTM();
    if (!layer || !ctm) return { x: 0, y: 0 };
    const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  }

  /** Client point relative to the board centre, in SVG units (for zooming). */
  function rel(clientX: number, clientY: number) {
    const rect = boxRef.current!.getBoundingClientRect();
    const s = svgScale();
    return { x: (clientX - rect.left - rect.width / 2) * s, y: (clientY - rect.top - rect.height / 2) * s };
  }

  function layerTransform(v: { x: number; y: number; k: number }) {
    return `translate(${v.x} ${v.y}) translate(${cx} ${cy}) scale(${v.k}) translate(${-cx} ${-cy})`;
  }
  // Pan and pinch move the whole SVG with a CSS transform (composited, so nothing
  // repaints) relative to the last committed view; the real view is drawn once when the
  // fingers lift, and the CSS transform is cleared in the same frame.
  const frame = useRef(0);
  const baseView = useRef(view);
  function liveView(v: { x: number; y: number; k: number }) {
    if (!live.current) baseView.current = view;
    live.current = true;
    viewRef.current = v;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const el = svgRef.current;
      if (!el || !live.current) return;
      const b = baseView.current;
      const c = viewRef.current;
      const dk = c.k / b.k;
      const s = svgScale();
      el.style.willChange = "transform";
      el.style.transform = `translate3d(${(c.x - dk * b.x) / s}px, ${(c.y - dk * b.y) / s}px, 0) scale(${dk})`;
    });
  }
  function commitView() {
    if (!live.current) return;
    live.current = false;
    cancelAnimationFrame(frame.current);
    setView({ ...viewRef.current });
  }
  useLayoutEffect(() => {
    const el = svgRef.current;
    if (!el || live.current) return;
    el.style.transform = "";
    el.style.willChange = "";
  }, [view]);

  const ghostRef = useRef<SVGSVGElement>(null);
  const dragBox = useRef({ left: 0, top: 0, lift: 0, size: 0 });
  const ghostPos = useRef({ x: 0, y: 0 });
  function moveGhost(clientX: number, clientY: number) {
    const d = dragBox.current;
    const x = clientX - d.left - d.size / 2;
    const y = clientY - d.top - d.lift - d.size / 2;
    ghostPos.current = { x, y };
    const el = ghostRef.current;
    if (el) el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  }

  function zoomAt(px: number, py: number, k: number, base = viewRef.current) {
    const nk = Math.min(4, Math.max(0.35, k));
    const f = nk / base.k;
    return { k: nk, x: px - (px - base.x) * f, y: py - (py - base.y) * f };
  }

  function onWheel(e: React.WheelEvent) {
    if (fixed) return;
    const p = rel(e.clientX, e.clientY);
    setView((v) => zoomAt(p.x, p.y, v.k * Math.exp(-e.deltaY * 0.0015), v));
  }

  function onPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    svgRef.current?.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2 && !fixed) {
      const [a, b] = [...pointers.current.values()];
      const m = rel((a.x + b.x) / 2, (a.y + b.y) / 2);
      setGhost(null);
      gesture.current = { kind: "pinch", d0: Math.hypot(a.x - b.x, a.y - b.y), k0: viewRef.current.k, mx0: m.x, my0: m.y, vx0: viewRef.current.x, vy0: viewRef.current.y };
      return;
    }
    if (pointers.current.size > 2) return;
    const item = (e.target as Element).closest("[data-piece],[data-move]");
    gesture.current = { kind: "press", id: e.pointerId, x: e.clientX, y: e.clientY, item, vx: viewRef.current.x, vy: viewRef.current.y, touch: e.pointerType !== "mouse" };
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    if (g.kind === "pinch" && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const m = rel((a.x + b.x) / 2, (a.y + b.y) / 2);
      // Zoom around the original midpoint, then follow the fingers.
      const z = zoomAt(g.mx0, g.my0, (g.k0 * d) / g.d0, { x: g.vx0, y: g.vy0, k: g.k0 });
      liveView({ k: z.k, x: z.x + (m.x - g.mx0), y: z.y + (m.y - g.my0) });
      return;
    }
    if (g.kind === "press" && g.id === e.pointerId) {
      const dist = Math.hypot(e.clientX - g.x, e.clientY - g.y);
      if (dist < (g.touch ? 10 : 5)) return;
      const name = g.item?.getAttribute("data-piece");
      if (name && (selectable.has(name) || name === selected) && onPieceClick) {
        if (name !== selected) onPieceClick(name);
        const piece = state.pieces.find((p) => p.name === name)!;
        // On touch, carry the tile above the fingertip so it stays visible.
        const lift = g.touch ? S * 1.1 : 0;
        gesture.current = { kind: "drag", id: e.pointerId, piece: name, lift };
        const rect = boxRef.current!.getBoundingClientRect();
        const px = viewRef.current.k / svgScale(); // CSS px per board unit
        dragBox.current = { left: rect.left, top: rect.top, lift: (lift + S * 0.25) * px, size: GHOST * 1.12 * px };
        moveGhost(e.clientX, e.clientY);
        setGhost({ piece, size: dragBox.current.size });
        buzz();
      } else if (fixed) {
        gesture.current = { kind: "idle" };
      } else {
        gesture.current = { kind: "pan", id: e.pointerId, x: g.x, y: g.y, vx: g.vx, vy: g.vy };
      }
    }
    const g2 = gesture.current;
    if (g2.kind === "pan" && g2.id === e.pointerId) {
      const s = svgScale();
      liveView({ ...viewRef.current, x: g2.vx + (e.clientX - g2.x) * s, y: g2.vy + (e.clientY - g2.y) * s });
    } else if (g2.kind === "drag" && g2.id === e.pointerId) {
      moveGhost(e.clientX, e.clientY);
    }
  }

  function nearestTarget(x: number, y: number) {
    let best: MoveView | null = null;
    let bd = S * 0.95;
    for (const m of targetsRef.current) {
      const [tx, ty] = hexToPixel(m.to[0], m.to[1]);
      const [ox, oy] = levelOffset(m.toLevel);
      const d = Math.hypot(tx + ox - x, ty + oy - y);
      if (d < bd) {
        bd = d;
        best = m;
      }
    }
    return best;
  }

  function onPointerUp(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId);
    const g = gesture.current;
    if (g.kind === "pan" || (g.kind === "pinch" && pointers.current.size === 0)) commitView();
    if (g.kind === "pinch") {
      if (pointers.current.size === 0) gesture.current = { kind: "idle" };
      return;
    }
    if (g.kind === "drag" && g.id === e.pointerId) {
      const p = toBoard(e.clientX, e.clientY);
      const m = nearestTarget(p.x, p.y - g.lift);
      setGhost(null);
      if (m) {
        buzz(14);
        onTargetClick?.(m);
      }
    } else if (g.kind === "press" && g.id === e.pointerId && e.type === "pointerup") {
      const move = g.item?.getAttribute("data-move");
      const piece = g.item?.getAttribute("data-piece");
      if (move) {
        const m = targetsRef.current.find((t) => t.notation === move);
        if (m) {
          buzz(14);
          onTargetClick?.(m);
        }
      } else if (piece && onPieceClick) {
        onPieceClick(piece);
      } else {
        const now = Date.now();
        if (now - lastTap.current < 320 && !fixed) setView({ x: 0, y: 0, k: 1 });
        lastTap.current = now;
        onBackgroundClick?.();
      }
    }
    if (pointers.current.size === 0) gesture.current = { kind: "idle" };
  }

  const lastFrom = hideLastMove ? null : state.lastMove?.from;
  const lastTo = hideLastMove ? null : state.lastMove?.to;
  // A piece just placed from the hand is set down with a little drop (it mounts fresh).
  const justPlaced = state.lastMove && !state.lastMove.from ? state.lastMove.piece : null;
  const legalCells = new Set(targets.map((m) => `${m.to[0]},${m.to[1]}`));
  const preview = previewTargets.filter((m) => !legalCells.has(`${m.to[0]},${m.to[1]}`));
  const dragging = ghost?.piece.name;
  const isDragging = !!ghost;
  useEffect(() => onDragChange?.(isDragging), [isDragging]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={boxRef} className={`relative h-full w-full overflow-hidden select-none board-paper`}>
      <svg
        ref={svgRef}
        className={`h-full w-full overflow-visible [transform-origin:50%_50%] ${fixed ? "touch-pan-y" : "touch-none"}`}
        data-dragging={dragging ? "" : undefined}
        viewBox={viewBox.join(" ")}
        preserveAspectRatio="xMidYMid meet"
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onContextMenu={(e) => e.preventDefault()}
        role="application"
        aria-label="Hive board"
      >
        <defs>
          <marker id="hint-arrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M0 1 L9 5 L0 9" fill="none" stroke="var(--violet)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </marker>
        </defs>
        <g ref={layerRef} transform={layerTransform(view)}>
          {lastFrom && (
            <path d={sketchHexPath(...hexToPixel(lastFrom[0], lastFrom[1]), S * 0.86, 3, 0.04)} fill="var(--accent)" fillOpacity={0.12} stroke="var(--accent)" strokeOpacity={0.75} strokeDasharray="2 7" strokeLinecap="round" strokeWidth={3} />
          )}
          {lastTo && <path d={sketchHexPath(...hexToPixel(lastTo[0], lastTo[1]), S * 1.08, 9, 0.06)} fill="var(--accent)" fillOpacity={0.38} />}

          {pieceItems.map(({ p, x, y, height, names }) => {
            const clickable = p.onTop && !!onPieceClick;
            const isSel = p.name === selected;
            return (
              <g
                key={p.name}
                data-piece={clickable ? p.name : undefined}
                style={{ transform: `translate(${x}px, ${y}px)`, transition: "transform 280ms cubic-bezier(.2,.8,.3,1)", opacity: dragging === p.name ? 0.35 : 1 }}
                className={clickable ? "cursor-pointer" : undefined}
              >
                <title>{names.length > 1 ? `Stack (bottom → top): ${names.join(", ")}` : p.name}</title>
                <g className={p.name === justPlaced ? "tile-set" : undefined}>
                  <PieceTile bug={p.bug} color={p.color} x={0} y={0} size={S} seed={pieceSeed(p.name)} />
                </g>
                {p.onTop && selectable.has(p.name) && !isSel && (
                  <path d={sketchHexPath(0, 0, S * 0.98, pieceSeed(p.name) + 11, 0.03)} fill="none" stroke="var(--move)" strokeOpacity={0.5} strokeWidth={2} strokeDasharray="1 5" strokeLinecap="round" />
                )}
                {isSel && (
                  <>
                    <path d={sketchHexPath(0, 0, S * 1.06, 21, 0.035)} fill="none" stroke="var(--select)" strokeWidth={4.2} strokeLinejoin="round" />
                    <path d={sketchHexPath(0, 0, S * 1.12, 22, 0.05)} fill="none" stroke="var(--select)" strokeWidth={1.6} opacity={0.6} />
                  </>
                )}
                {p.onTop && height > 1 && (
                  <g transform={`translate(${S * 0.58} ${-S * 0.66})`}>
                    <circle r={S * 0.26} fill="var(--paper)" stroke="var(--ink)" strokeWidth={2} />
                    <text textAnchor="middle" dy="0.36em" fontSize={S * 0.34} fontWeight={700} fill="var(--ink)" fontFamily="var(--font-hand)">
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
            <Target key={m.notation} m={m} kind="legal" />
          ))}

          {hint && (
            <g pointerEvents="none">
              {hint.from &&
                (() => {
                  const [x1, y1] = hexToPixel(hint.from[0], hint.from[1]);
                  const [x2, y2] = hexToPixel(hint.to[0], hint.to[1]);
                  const mx = (x1 + x2) / 2 - (y2 - y1) * 0.18;
                  const my = (y1 + y2) / 2 + (x2 - x1) * 0.18;
                  return <path d={`M${x1} ${y1} Q${mx} ${my} ${x2} ${y2}`} fill="none" stroke="var(--violet)" strokeWidth={5} strokeLinecap="round" markerEnd="url(#hint-arrow)" opacity={0.9} />;
                })()}
              <path d={inkLoop(...hexToPixel(hint.to[0], hint.to[1]), S * 0.72, 2)} fill="none" stroke="var(--violet)" strokeWidth={4} strokeLinecap="round" />
            </g>
          )}

        </g>
      </svg>
      {ghost && (
        <svg
          ref={ghostRef}
          viewBox={`${-GHOST / 2} ${-GHOST / 2} ${GHOST} ${GHOST}`}
          className="pointer-events-none absolute top-0 left-0 overflow-visible will-change-transform"
          style={{ width: ghost.size, height: ghost.size, transform: `translate3d(${ghostPos.current.x}px, ${ghostPos.current.y}px, 0)` }}
          opacity={0.95}
          aria-hidden
        >
          <PieceTile bug={ghost.piece.bug} color={ghost.piece.color} x={0} y={0} size={S} seed={pieceSeed(ghost.piece.name)} />
        </svg>
      )}
      {(view.x !== 0 || view.y !== 0 || view.k !== 1) && (
        <button className="btn-ghost absolute right-2 bottom-2" onClick={() => setView({ x: 0, y: 0, k: 1 })}>
          Re-centre
        </button>
      )}
    </div>
  );
}
