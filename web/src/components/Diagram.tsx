import { hexPoints } from "./BugGlyph";
import { PieceTile, TileDefs } from "./PieceTile";
import type { BugLetter, ColorCode } from "@/lib/engine-types";

const S = 40;
const SQ3 = Math.sqrt(3);
const px = (q: number, r: number) => [S * SQ3 * (q + r / 2), S * 1.5 * r] as const;

export interface DiagramPiece {
  q: number;
  r: number;
  bug: BugLetter;
  color: ColorCode;
}

export interface DiagramMark {
  q: number;
  r: number;
  kind: "ok" | "no";
}

/** Static board diagram for the field guide. */
export function Diagram({ pieces, marks = [], arrows = [], height = 220 }: { pieces: DiagramPiece[]; marks?: DiagramMark[]; arrows?: [number, number, number, number][]; height?: number }) {
  const pts = [...pieces.map((p) => px(p.q, p.r)), ...marks.map((m) => px(m.q, m.r))];
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const pad = S * 1.4;
  const vb = [Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) - Math.min(...xs) + 2 * pad, Math.max(...ys) - Math.min(...ys) + 2 * pad];
  return (
    <svg viewBox={vb.join(" ")} style={{ height }} className="board-paper w-full rounded-2xl border border-line" role="img">
      <TileDefs />
      <defs>
        <marker id="diag-arrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill="var(--sky)" />
        </marker>
      </defs>
      {pieces.map((p, i) => {
        const [x, y] = px(p.q, p.r);
        return <PieceTile key={i} bug={p.bug} color={p.color} x={x} y={y} size={S} style="field" />;
      })}
      {marks.map((m, i) => {
        const [x, y] = px(m.q, m.r);
        const c = m.kind === "ok" ? "var(--leaf)" : "var(--danger)";
        return (
          <g key={i}>
            <polygon points={hexPoints(x, y, S * 0.88)} fill={c} fillOpacity={0.14} stroke={c} strokeWidth={3} strokeDasharray="7 5" />
            <text x={x} y={y} textAnchor="middle" dy="0.35em" fontSize={S * 0.7} fontWeight={800} fill={c}>
              {m.kind === "ok" ? "✓" : "✕"}
            </text>
          </g>
        );
      })}
      {arrows.map(([q1, r1, q2, r2], i) => {
        const [x1, y1] = px(q1, r1);
        const [x2, y2] = px(q2, r2);
        return <line key={i} x1={x1} y1={y1} x2={x1 + (x2 - x1) * 0.78} y2={y1 + (y2 - y1) * 0.78} stroke="var(--sky)" strokeWidth={5} strokeLinecap="round" markerEnd="url(#diag-arrow)" />;
      })}
    </svg>
  );
}
