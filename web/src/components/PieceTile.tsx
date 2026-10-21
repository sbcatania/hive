import { BugGlyph, hexPoints } from "./BugGlyph";
import { TILE } from "@/lib/themes";
import type { BugLetter, ColorCode } from "@/lib/engine-types";

interface Props {
  bug: BugLetter;
  color: ColorCode;
  x: number;
  y: number;
  size: number;
  style: "flat" | "tiles";
  dim?: boolean;
}

/** One hexagonal piece drawn at (x, y). */
export function PieceTile({ bug, color, x, y, size, style, dim }: Props) {
  const t = TILE[color];
  const glyph = size * 1.05;
  const inner = (
    <g transform={`translate(${x - glyph / 2} ${y - glyph / 2}) scale(${glyph / 100})`}>
      <BugGlyph bug={bug} ink={t.ink} />
    </g>
  );
  if (style === "flat") {
    return (
      <g opacity={dim ? 0.55 : 1}>
        <polygon points={hexPoints(x, y, size * 0.96)} fill={t.fill} stroke={t.edge} strokeWidth={size * 0.05} strokeLinejoin="round" />
        {inner}
      </g>
    );
  }
  const depth = size * 0.16;
  return (
    <g opacity={dim ? 0.55 : 1}>
      <polygon points={hexPoints(x, y + depth, size * 0.95)} fill={t.side} stroke={t.edge} strokeWidth={size * 0.04} strokeLinejoin="round" filter="url(#tile-shadow)" />
      <polygon points={hexPoints(x, y, size * 0.95)} fill={`url(#tile-grad-${color})`} stroke={t.edge} strokeWidth={size * 0.04} strokeLinejoin="round" />
      <polygon points={hexPoints(x, y, size * 0.8)} fill="none" stroke={color === "w" ? "#ffffff" : "#5a5a62"} strokeOpacity={0.6} strokeWidth={size * 0.03} />
      {inner}
    </g>
  );
}

/** Gradients and shadows used by the "tiles" style. Render once per <svg>. */
export function TileDefs() {
  return (
    <defs>
      {(["w", "b"] as const).map((c) => (
        <linearGradient key={c} id={`tile-grad-${c}`} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor={TILE[c].gradient[0]} />
          <stop offset="1" stopColor={TILE[c].gradient[1]} />
        </linearGradient>
      ))}
      <filter id="tile-shadow" x="-30%" y="-30%" width="160%" height="170%">
        <feDropShadow dx="0" dy="3" stdDeviation="3" floodOpacity="0.35" />
      </filter>
    </defs>
  );
}
