import { BugGlyph } from "./BugGlyph";
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
}

/** One hexagonal piece drawn centred on (x, y). Needs <TileDefs/> in the same SVG. */
export function PieceTile({ bug, color, x, y, size, style, dim }: Props) {
  const t = TILE[color];
  const glyphSize = size * (style === "clean" ? 1.08 : 1.0);
  const glyph = (ink: string) => (
    <g transform={`translate(${x - glyphSize / 2} ${y - glyphSize / 2}) scale(${glyphSize / 100})`}>
      <BugGlyph bug={bug} ink={ink} />
    </g>
  );
  const rim = color === "b" ? "var(--tile-black-rim)" : t.edge;

  if (style === "clean") {
    return (
      <g opacity={dim ? 0.5 : 1}>
        <path d={roundedHexPath(x, y, size * 0.95, 0.1)} fill={t.fill} stroke={rim} strokeWidth={size * 0.06} />
        {glyph(t.ink)}
      </g>
    );
  }

  if (style === "field") {
    // Ink line art with a watercolour wash; the wobble filter is applied by the board.
    const wash = color === "w" ? "#fbf6e8" : "#3a3935";
    return (
      <g opacity={dim ? 0.5 : 1}>
        <path d={roundedHexPath(x + size * 0.05, y + size * 0.07, size * 0.93, 0.08)} fill="#000" opacity={0.12} />
        <path d={roundedHexPath(x, y, size * 0.93, 0.08)} fill={wash} stroke={color === "w" ? "#3b3326" : "#d8d0bd"} strokeWidth={size * 0.045} filter="url(#ink-wobble)" />
        <g filter="url(#ink-wobble)" opacity={0.95}>
          {glyph(color === "w" ? "#2b2418" : "#efe8d6")}
        </g>
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
        {glyph(color === "w" ? "#8a7a55" : "#000000")}
      </g>
      {glyph(t.ink)}
      <ellipse cx={x - size * 0.28} cy={y - size * 0.5} rx={size * 0.34} ry={size * 0.1} fill="#fff" opacity={color === "w" ? 0.45 : 0.12} transform={`rotate(-25 ${x - size * 0.28} ${y - size * 0.5})`} />
    </g>
  );
}

/** Gradients, shadows and filters used by the tile styles. Render once per <svg>. */
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
      <filter id="ink-wobble" x="-10%" y="-10%" width="120%" height="120%">
        <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="2" seed="3" result="n" />
        <feDisplacementMap in="SourceGraphic" in2="n" scale="3.2" />
      </filter>
    </defs>
  );
}
