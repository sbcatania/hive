import { PieceTile, sketchHexPath } from "./PieceTile";
import type { BugLetter, ColorCode } from "@/lib/engine-types";

const S = 34;
const SQ3 = Math.sqrt(3);
const px = (q: number, r: number) => [S * SQ3 * (q + r / 2), S * 1.5 * r] as const;

// A small, plausible mid-game hive. Each cell is a separate tile: nothing overlaps.
const TILES: { q: number; r: number; bug: BugLetter; color: ColorCode }[] = [
  { q: 0, r: 0, bug: "Q", color: "w" },
  { q: 1, r: -1, bug: "S", color: "w" },
  { q: 1, r: 0, bug: "A", color: "b" },
  { q: -1, r: 0, bug: "L", color: "b" },
  { q: 0, r: 1, bug: "B", color: "b" },
  { q: -1, r: 1, bug: "G", color: "w" },
  { q: 2, r: -1, bug: "Q", color: "b" },
  { q: -2, r: 1, bug: "P", color: "w" },
];

// Handwritten specimen labels with arrows pointing at their tile.
const NOTES: { text: string; sub?: string; at: [number, number]; to: [number, number]; anchor: "start" | "end" }[] = [
  { text: "the Queen Bee", sub: "surround her to win", at: [-205, -100], to: [-16, -20], anchor: "start" },
  { text: "Soldier Ant", sub: "goes anywhere", at: [212, 14], to: [94, 4], anchor: "end" },
  { text: "Grasshopper", sub: "jumps in a line", at: [-205, 118], to: [-42, 70], anchor: "start" },
  { text: "Beetle", sub: "climbs on top", at: [212, 118], to: [44, 72], anchor: "end" },
];

/** Title illustration: a hive drawn into the sketchbook, line by line, with notes. */
export function SketchHero({ className }: { className?: string }) {
  const t0 = 150;
  return (
    <svg viewBox="-215 -140 430 285" className={className} role="img" aria-label="A sketch of a small hive of game tiles with handwritten labels">
      {/* the six cells around the white Queen, pencilled in */}
      {TILES.map((t, i) => {
        const [x, y] = px(t.q, t.r);
        const delay = t0 + i * 110;
        return (
          <g key={i}>
            <path
              d={sketchHexPath(x, y, S * 0.97, i * 13 + 4, 0.05)}
              fill="none"
              stroke="var(--ink-soft)"
              strokeWidth={1.3}
              pathLength={1}
              className="draw-in"
              style={{ ["--len" as string]: 1, animationDelay: `${delay}ms` }}
            />
            <g className="wash-in" style={{ animationDelay: `${delay + 380}ms` }}>
              <PieceTile bug={t.bug} color={t.color} x={x} y={y} size={S} seed={i * 13 + 4} />
            </g>
          </g>
        );
      })}
      {NOTES.map((n, i) => {
        const [ax, ay] = n.at;
        const [bx, by] = n.to;
        const sx = ax + (n.anchor === "start" ? 1 : -1) * (n.text.length * 5.5);
        const sy = ay + (ay < 0 ? 26 : ay > 60 ? -24 : 26);
        const cx = (sx + bx) / 2;
        const cy = (sy + by) / 2 + (ay < 0 ? 22 : -16);
        const delay = t0 + TILES.length * 110 + 300 + i * 260;
        const ang = Math.atan2(by - cy, bx - cx);
        const head = (d: number) => `${bx - 9 * Math.cos(ang + d)} ${by - 9 * Math.sin(ang + d)}`;
        return (
          <g key={i} className="wash-in" style={{ animationDelay: `${delay}ms` }}>
            <text x={ax} y={ay} textAnchor={n.anchor} fontFamily="var(--font-hand)" fontSize={23} fill="var(--ink)">
              {n.text}
            </text>
            {n.sub && (
              <text x={ax} y={ay + 18} textAnchor={n.anchor} fontFamily="var(--font-hand)" fontSize={17} fill="var(--muted)">
                {n.sub}
              </text>
            )}
            <path
              d={`M${sx} ${sy} Q${cx} ${cy} ${bx} ${by} M${head(0.45)} L${bx} ${by} L${head(-0.45)}`}
              fill="none"
              stroke="var(--muted)"
              strokeWidth={1.7}
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength={1}
              className="draw-in"
              style={{ ["--len" as string]: 1, animationDelay: `${delay + 120}ms` }}
            />
          </g>
        );
      })}
    </svg>
  );
}
