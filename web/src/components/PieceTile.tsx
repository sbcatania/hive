import { BUG_ART, paintColor } from "@/lib/bug-art";
import type { BugLetter, ColorCode } from "@/lib/engine-types";

export type TileStyle = "bakelite" | "field" | "clean";

interface Props {
  bug: BugLetter;
  color: ColorCode;
  x: number;
  y: number;
  size: number;
  dim?: boolean;
  /** Varies the hand-drawn wobble so neighbouring tiles don't look stamped. */
  seed?: number;
}

function rand(seed: number) {
  let s = (seed * 2654435761) >>> 0;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 10000) / 10000;
  };
}

/** A hexagon drawn by hand: jittered corners and slightly bowed edges. */
export function sketchHexPath(cx: number, cy: number, r: number, seed: number, wobble = 0.035) {
  const rnd = rand(seed + 1);
  const pts = Array.from({ length: 6 }, (_, i) => {
    const a = ((60 * i - 90) * Math.PI) / 180;
    const rr = r * (1 + (rnd() - 0.5) * wobble * 2);
    return [cx + rr * Math.cos(a), cy + rr * Math.sin(a)] as const;
  });
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 1; i <= 6; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i % 6];
    const mx = (x0 + x1) / 2 + (rnd() - 0.5) * r * wobble * 2.2;
    const my = (y0 + y1) / 2 + (rnd() - 0.5) * r * wobble * 2.2;
    d += ` Q${mx.toFixed(1)} ${my.toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}`;
  }
  return d + "Z";
}

/** Bug as ink line art over a slightly mis-registered watercolour wash. */
function InkBug({ bug, ink, washOpacity }: { bug: BugLetter; ink: string; washOpacity: number }) {
  const shapes = BUG_ART[bug];
  return (
    <g>
      <g transform="translate(2.2 1.6)" opacity={washOpacity}>
        {shapes.map((s, i) =>
          s.fill === "main" || s.fill === "light" ? <path key={i} d={s.d} fill={paintColor(s.fill, bug, ink)} stroke={paintColor(s.fill, bug, ink)} strokeWidth={3} strokeLinejoin="round" /> : null,
        )}
      </g>
      {shapes.map((s, i) => (
        <path
          key={i}
          d={s.d}
          fill={s.fill === "ink" ? ink : s.fill === "dark" ? paintColor("dark", bug, ink) : "none"}
          stroke={s.stroke ? ink : s.fill === "main" || s.fill === "light" ? ink : "none"}
          strokeWidth={s.stroke ? (s.width ?? 2) * 0.95 : 1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </g>
  );
}

/** One hexagonal piece drawn centred on (x, y): an inked outline, a second loose
 * pen stroke, and the bug over a slightly mis-registered watercolour wash. */
export function PieceTile({ bug, color, x, y, size, dim, seed = 0 }: Props) {
  const white = color === "w";
  const line = white ? "#1f2023" : "#eceae6";
  const paper = white ? "var(--tile-white)" : "var(--tile-black)";
  const s = size * 1.02;
  return (
    <g opacity={dim ? 0.5 : 1}>
      <path d={sketchHexPath(x, y, size * 0.93, seed)} fill={paper} stroke={white ? line : "var(--tile-black-rim)"} strokeWidth={size * 0.055} strokeLinejoin="round" />
      <path d={sketchHexPath(x, y, size * 0.9, seed + 3, 0.05)} fill="none" stroke={line} strokeWidth={size * 0.022} opacity={white ? 0.55 : 0.4} />
      <g transform={`translate(${x - s / 2} ${y - s / 2}) scale(${s / 100})`}>
        <InkBug bug={bug} ink={line} washOpacity={white ? 0.82 : 0.92} />
      </g>
    </g>
  );
}

/** A small tile for menus, hands and avatars. */
export function MiniTile({ bug, color = "w", size = 40, seed = 1, className }: { bug: BugLetter; color?: ColorCode; size?: number; seed?: number; className?: string }) {
  return (
    <svg viewBox="-50 -50 100 100" width={size} height={size} className={`shrink-0 overflow-visible ${className ?? ""}`} aria-hidden>
      <PieceTile bug={bug} color={color} x={0} y={0} size={46} seed={seed} />
    </svg>
  );
}
