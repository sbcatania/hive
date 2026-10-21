import { BUG_ART, paintColor } from "@/lib/bug-art";
import type { BugLetter } from "@/lib/engine-types";

/** Bug drawing in a 100x100 box. Place inside an <svg> or <g>. */
export function BugGlyph({ bug, ink }: { bug: BugLetter; ink: string }) {
  return (
    <g>
      {BUG_ART[bug].map((s, i) => (
        <path
          key={i}
          d={s.d}
          fill={paintColor(s.fill, bug, ink)}
          stroke={s.stroke ? paintColor(s.stroke, bug, ink) : "none"}
          strokeWidth={s.width ?? 0}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={s.opacity ?? 1}
        />
      ))}
    </g>
  );
}

export const HEX_POINTS_UNIT = Array.from({ length: 6 }, (_, i) => {
  const a = ((60 * i - 90) * Math.PI) / 180;
  return [Math.cos(a), Math.sin(a)] as const;
});

export function hexPoints(cx: number, cy: number, size: number) {
  return HEX_POINTS_UNIT.map(([x, y]) => `${(cx + x * size).toFixed(2)},${(cy + y * size).toFixed(2)}`).join(" ");
}
