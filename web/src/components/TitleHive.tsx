import { PieceTile, TileDefs } from "./PieceTile";
import type { BugLetter, ColorCode } from "@/lib/engine-types";

const S = 34;
const SQ3 = Math.sqrt(3);
const px = (q: number, r: number) => [S * SQ3 * (q + r / 2), S * 1.5 * r] as const;

// A small, plausible mid-game hive around the wordmark.
const TILES: { q: number; r: number; bug: BugLetter; color: ColorCode; fx: string; fy: string; fr: string }[] = [
  { q: 0, r: 0, bug: "Q", color: "w", fx: "0px", fy: "-90px", fr: "-20deg" },
  { q: 1, r: 0, bug: "A", color: "b", fx: "120px", fy: "-40px", fr: "30deg" },
  { q: -1, r: 1, bug: "G", color: "w", fx: "-140px", fy: "60px", fr: "-35deg" },
  { q: 0, r: 1, bug: "B", color: "b", fx: "40px", fy: "120px", fr: "25deg" },
  { q: 1, r: -1, bug: "S", color: "w", fx: "160px", fy: "-110px", fr: "-15deg" },
  { q: -1, r: 0, bug: "L", color: "b", fx: "-170px", fy: "-30px", fr: "40deg" },
  { q: 2, r: -1, bug: "M", color: "b", fx: "200px", fy: "-60px", fr: "-30deg" },
  { q: -2, r: 1, bug: "P", color: "w", fx: "-200px", fy: "40px", fr: "20deg" },
  { q: 0, r: -1, bug: "Q", color: "b", fx: "-40px", fy: "-140px", fr: "15deg" },
];

/** Title illustration: tiles fly in and settle into a little hive. */
export function TitleHive({ className }: { className?: string }) {
  const pts = TILES.map((t) => px(t.q, t.r));
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const pad = S * 1.4;
  const vb = [Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) - Math.min(...xs) + 2 * pad, Math.max(...ys) - Math.min(...ys) + 2 * pad + S * 0.3];
  return (
    <svg viewBox={vb.join(" ")} className={className} role="img" aria-label="A small hive of game tiles">
      <TileDefs />
      {TILES.map((t, i) => {
        const [x, y] = pts[i];
        return (
          <g
            key={i}
            className="tile-in"
            style={{ ["--fx" as string]: t.fx, ["--fy" as string]: t.fy, ["--fr" as string]: t.fr, animationDelay: `${120 + i * 90}ms`, transformOrigin: `${x}px ${y}px` }}
          >
            <PieceTile bug={t.bug} color={t.color} x={x} y={y} size={S} style="bakelite" />
          </g>
        );
      })}
    </svg>
  );
}
