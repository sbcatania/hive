// Bug artwork as plain path data in a 100x100 box centred on (50, 50), so the
// same drawings render in SVG (2D themes) and onto canvas textures (3D theme).
import type { BugLetter } from "./engine-types";

export type Paint = "main" | "ink" | "light" | "none";

export interface Shape {
  d: string;
  fill: Paint;
  stroke?: Paint;
  width?: number;
  opacity?: number;
}

export const BUG_COLORS: Record<BugLetter, string> = {
  Q: "#e8b225",
  S: "#9b5a2c",
  B: "#7a4cc2",
  G: "#3a9a42",
  A: "#2c6fd8",
  M: "#8b919c",
  L: "#d6372a",
  P: "#239e9b",
};

function ellipse(cx: number, cy: number, rx: number, ry: number, rotDeg = 0): string {
  const t = (rotDeg * Math.PI) / 180;
  const dx = rx * Math.cos(t);
  const dy = rx * Math.sin(t);
  const sx = (cx - dx).toFixed(2);
  const sy = (cy - dy).toFixed(2);
  return `M${sx} ${sy} a${rx} ${ry} ${rotDeg} 1 0 ${(2 * dx).toFixed(2)} ${(2 * dy).toFixed(2)} a${rx} ${ry} ${rotDeg} 1 0 ${(-2 * dx).toFixed(2)} ${(-2 * dy).toFixed(2)}Z`;
}

const circle = (cx: number, cy: number, r: number) => ellipse(cx, cy, r, r);
const line = (pts: [number, number][]) => "M" + pts.map((p) => p.join(" ")).join(" L");
const legs = (pts: [number, number][][], width = 3.5): Shape[] =>
  pts.map((p) => ({ d: line(p), fill: "none", stroke: "ink", width }));
const mirror = (pts: [number, number][][]): [number, number][][] =>
  pts.flatMap((p) => [p, p.map(([x, y]) => [100 - x, y] as [number, number])]);

export const BUG_ART: Record<BugLetter, Shape[]> = {
  Q: [
    { d: ellipse(33, 44, 15, 8, -35), fill: "light", stroke: "ink", width: 2, opacity: 0.9 },
    { d: ellipse(67, 44, 15, 8, 35), fill: "light", stroke: "ink", width: 2, opacity: 0.9 },
    ...legs(mirror([[[42, 52], [30, 60], [28, 70]], [[42, 60], [32, 70], [32, 80]]]), 3),
    { d: ellipse(50, 60, 14, 22), fill: "main", stroke: "ink", width: 2.5 },
    { d: line([[37, 54], [63, 54]]), fill: "none", stroke: "ink", width: 5 },
    { d: line([[37, 64], [63, 64]]), fill: "none", stroke: "ink", width: 5 },
    { d: line([[40, 74], [60, 74]]), fill: "none", stroke: "ink", width: 4.5 },
    { d: circle(50, 33, 9), fill: "ink" },
    { d: "M41 25 L43 15 L47 21 L50 13 L53 21 L57 15 L59 25 Z", fill: "main", stroke: "ink", width: 1.5 },
  ],
  B: [
    ...legs(mirror([[[34, 48], [22, 42], [16, 32]], [[32, 58], [18, 60], [12, 66]], [[34, 70], [22, 78], [20, 88]]])),
    ...legs(mirror([[[46, 22], [40, 12], [34, 10]]]), 2.5),
    { d: ellipse(50, 58, 20, 26), fill: "main", stroke: "ink", width: 2.5 },
    { d: line([[50, 34], [50, 83]]), fill: "none", stroke: "ink", width: 2.5 },
    { d: ellipse(50, 29, 11, 8), fill: "ink" },
    { d: ellipse(42, 50, 4, 7, 15), fill: "light", opacity: 0.55 },
  ],
  G: [
    ...legs(mirror([[[45, 58], [24, 40], [20, 84]]]), 5),
    ...legs(mirror([[[45, 40], [34, 44], [30, 52]], [[45, 48], [32, 56], [30, 64]]]), 3),
    ...legs(mirror([[[47, 16], [38, 6], [30, 4]]]), 2),
    { d: ellipse(50, 52, 10, 30), fill: "main", stroke: "ink", width: 2.5 },
    { d: circle(50, 20, 8), fill: "main", stroke: "ink", width: 2.5 },
    { d: circle(46, 18, 2.2), fill: "ink" },
    { d: circle(54, 18, 2.2), fill: "ink" },
  ],
  S: [
    ...legs(
      mirror([
        [[44, 38], [28, 24], [20, 30]],
        [[43, 41], [24, 36], [14, 44]],
        [[43, 44], [24, 52], [16, 64]],
        [[44, 47], [30, 62], [26, 78]],
      ]),
      3.5,
    ),
    { d: circle(50, 64, 17), fill: "main", stroke: "ink", width: 2.5 },
    { d: circle(50, 40, 10), fill: "main", stroke: "ink", width: 2.5 },
    { d: "M50 54 L50 74 M44 64 L56 64", fill: "none", stroke: "ink", width: 2 },
    { d: circle(46, 36, 2), fill: "ink" },
    { d: circle(54, 36, 2), fill: "ink" },
  ],
  A: [
    ...legs(mirror([[[45, 40], [30, 30], [24, 22]], [[44, 44], [26, 46], [18, 52]], [[45, 48], [32, 60], [28, 72]]])),
    ...legs(mirror([[[46, 18], [40, 10], [32, 12]]]), 2.5),
    { d: ellipse(50, 68, 13, 18), fill: "main", stroke: "ink", width: 2.5 },
    { d: ellipse(50, 44, 7, 10), fill: "main", stroke: "ink", width: 2.5 },
    { d: circle(50, 25, 9), fill: "main", stroke: "ink", width: 2.5 },
    { d: circle(46, 23, 2), fill: "ink" },
    { d: circle(54, 23, 2), fill: "ink" },
  ],
  M: [
    { d: ellipse(34, 50, 17, 6, -20), fill: "light", stroke: "ink", width: 1.5, opacity: 0.85 },
    { d: ellipse(66, 50, 17, 6, 20), fill: "light", stroke: "ink", width: 1.5, opacity: 0.85 },
    ...legs(mirror([[[47, 46], [26, 30], [14, 22]], [[47, 52], [24, 58], [10, 60]], [[47, 58], [30, 76], [24, 94]]]), 2),
    { d: ellipse(50, 62, 6, 22), fill: "main", stroke: "ink", width: 2 },
    { d: ellipse(50, 42, 7, 8), fill: "main", stroke: "ink", width: 2 },
    { d: circle(50, 30, 6), fill: "ink" },
    { d: line([[50, 26], [50, 6]]), fill: "none", stroke: "ink", width: 2.5 },
  ],
  L: [
    ...legs(mirror([[[34, 46], [22, 40]], [[30, 58], [17, 60]], [[34, 70], [24, 80]]])),
    { d: circle(50, 58, 24), fill: "main", stroke: "ink", width: 2.5 },
    { d: line([[50, 34], [50, 82]]), fill: "none", stroke: "ink", width: 2.5 },
    { d: "M36 36 A16 14 0 0 1 64 36 L50 40 Z", fill: "ink" },
    { d: circle(40, 52, 5), fill: "ink" },
    { d: circle(60, 52, 5), fill: "ink" },
    { d: circle(37, 68, 4.5), fill: "ink" },
    { d: circle(63, 68, 4.5), fill: "ink" },
    { d: circle(50, 33, 3), fill: "light" },
  ],
  P: [
    ...legs(mirror([[[32, 44], [24, 42]], [[30, 54], [21, 54]], [[30, 64], [22, 66]], [[33, 74], [26, 78]]]), 3),
    ...legs(mirror([[[44, 24], [36, 14]]]), 2.5),
    { d: ellipse(50, 54, 20, 29), fill: "main", stroke: "ink", width: 2.5 },
    { d: "M32 40 Q50 34 68 40", fill: "none", stroke: "ink", width: 2.5 },
    { d: "M30 50 Q50 44 70 50", fill: "none", stroke: "ink", width: 2.5 },
    { d: "M30 60 Q50 54 70 60", fill: "none", stroke: "ink", width: 2.5 },
    { d: "M32 70 Q50 64 68 70", fill: "none", stroke: "ink", width: 2.5 },
    { d: ellipse(50, 28, 10, 5), fill: "ink" },
  ],
};

export function paintColor(p: Paint, bug: BugLetter, ink: string): string {
  switch (p) {
    case "main":
      return BUG_COLORS[bug];
    case "ink":
      return ink;
    case "light":
      return "#f4f1ea";
    default:
      return "none";
  }
}
