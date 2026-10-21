import { BugGlyph } from "./BugGlyph";
import { BUG_ART, paintColor } from "@/lib/bug-art";
import { roundedHexPath, TILE } from "@/lib/themes";
import type { BugLetter, ColorCode } from "@/lib/engine-types";

export type TileStyle = "bakelite" | "field" | "clean";

interface Props {
  bug: BugLetter;
  color: ColorCode;
  x: number;
  y: number;
  size: number;
  style: TileStyle;
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
          fill={s.fill === "ink" ? ink : "none"}
          stroke={s.stroke ? ink : s.fill === "main" || s.fill === "light" ? ink : "none"}
          strokeWidth={s.stroke ? (s.width ?? 2) * 0.95 : 1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </g>
  );
}

/** One hexagonal piece drawn centred on (x, y). Needs <TileDefs/> in the same SVG. */
export function PieceTile({ bug, color, x, y, size, style, dim, seed = 0 }: Props) {
  const t = TILE[color];
  const glyphSize = size * (style === "clean" ? 1.08 : 1.0);
  const place = (node: React.ReactNode, s = glyphSize) => <g transform={`translate(${x - s / 2} ${y - s / 2}) scale(${s / 100})`}>{node}</g>;
  const rim = color === "b" ? "var(--tile-black-rim)" : t.edge;

  if (style === "clean") {
    return (
      <g opacity={dim ? 0.5 : 1}>
        <path d={roundedHexPath(x, y, size * 0.95, 0.1)} fill={t.fill} stroke={rim} strokeWidth={size * 0.06} />
        {place(<BugGlyph bug={bug} ink={t.ink} />)}
      </g>
    );
  }

  if (style === "field") {
    const white = color === "w";
    const line = white ? "#2b2218" : "#efe6d2";
    const wash = white ? "#fbf5e6" : "#2d2b29";
    return (
      <g opacity={dim ? 0.5 : 1}>
        {/* soft wash shadow, offset like a quick brush stroke */}
        <path d={sketchHexPath(x + size * 0.07, y + size * 0.09, size * 0.92, seed + 7, 0.05)} fill="#3a2a17" opacity={0.13} />
        <path d={sketchHexPath(x, y, size * 0.93, seed)} fill={wash} stroke={line} strokeWidth={size * 0.055} strokeLinejoin="round" />
        <path d={sketchHexPath(x, y, size * 0.9, seed + 3, 0.05)} fill="none" stroke={line} strokeWidth={size * 0.022} opacity={0.55} />
        {!white && <path d={sketchHexPath(x, y, size * 0.78, seed + 5, 0.06)} fill="none" stroke="#ffffff" strokeWidth={size * 0.02} opacity={0.12} />}
        {place(<InkBug bug={bug} ink={line} washOpacity={white ? 0.82 : 0.92} />, size * 1.02)}
      </g>
    );
  }

  // Bakelite: thick bevelled tile with a glossy top and a lightly engraved bug.
  const depth = size * 0.17;
  const r = size * 0.95;
  return (
    <g opacity={dim ? 0.5 : 1}>
      <path d={roundedHexPath(x, y + depth, r, 0.2)} fill={t.side} stroke={rim} strokeWidth={size * 0.035} filter="url(#tile-shadow)" />
      <path d={roundedHexPath(x, y, r, 0.2)} fill={`url(#tile-grad-${color})`} stroke={rim} strokeWidth={size * 0.035} />
      <path d={roundedHexPath(x, y, r * 0.86, 0.2)} fill="none" stroke={`url(#tile-bevel-${color})`} strokeWidth={size * 0.07} opacity={0.8} />
      <g opacity={color === "w" ? 0.28 : 0.5} transform={`translate(${size * 0.02} ${size * 0.025})`}>
        {place(<BugGlyph bug={bug} ink={color === "w" ? "#8a7a55" : "#000000"} />)}
      </g>
      {place(<BugGlyph bug={bug} ink={t.ink} />)}
      <ellipse cx={x - size * 0.28} cy={y - size * 0.5} rx={size * 0.34} ry={size * 0.1} fill="#fff" opacity={color === "w" ? 0.45 : 0.12} transform={`rotate(-25 ${x - size * 0.28} ${y - size * 0.5})`} />
    </g>
  );
}

/** Gradients and shadows used by the tile styles. Render once per <svg>. */
export function TileDefs() {
  return (
    <defs>
      {(["w", "b"] as const).map((c) => (
        <g key={c}>
          <linearGradient id={`tile-grad-${c}`} x1="0" y1="0" x2="0.35" y2="1">
            <stop offset="0" stopColor={TILE[c].gradient[0]} />
            <stop offset="1" stopColor={TILE[c].gradient[1]} />
          </linearGradient>
          <linearGradient id={`tile-bevel-${c}`} x1="0" y1="0" x2="0.6" y2="1">
            <stop offset="0" stopColor={TILE[c].shine} stopOpacity={c === "w" ? 0.95 : 0.45} />
            <stop offset="0.5" stopColor={TILE[c].shine} stopOpacity={0} />
            <stop offset="1" stopColor="#000" stopOpacity={c === "w" ? 0.12 : 0.35} />
          </linearGradient>
        </g>
      ))}
      <filter id="tile-shadow" x="-30%" y="-30%" width="160%" height="170%">
        <feDropShadow dx="0" dy="4" stdDeviation="3.5" floodOpacity="0.32" />
      </filter>
    </defs>
  );
}

/** A small tile for menus, hands and avatars, in the sketchbook style. */
export function MiniTile({ bug, color = "w", size = 40, seed = 1, className }: { bug: BugLetter; color?: ColorCode; size?: number; seed?: number; className?: string }) {
  return (
    <svg viewBox="-50 -50 100 100" width={size} height={size} className={`shrink-0 overflow-visible ${className ?? ""}`} aria-hidden>
      <PieceTile bug={bug} color={color} x={0} y={0} size={46} style="field" seed={seed} />
    </svg>
  );
}
