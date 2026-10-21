// Bug artwork as plain path data in a 100x100 box centred on (50, 50), so the
// same drawings render in SVG (2D themes) and onto canvas textures (3D theme).
import type { BugLetter } from "./engine-types";

/** main: the bug's colour; ink: the tile's line colour; light: pale wing/highlight; dark: always-dark parts. */
export type Paint = "main" | "ink" | "light" | "dark" | "none";

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
type Pt = [number, number];
const flip = (p: Pt[]): Pt[] => p.map(([x, y]) => [100 - x, y] as Pt);
const mirror = (pts: Pt[][]): Pt[][] => pts.flatMap((p) => [p, flip(p)]);
/** Jointed legs: each segment a little thinner than the last, so they taper to the foot. */
const legs = (pts: Pt[][], width = 3.2): Shape[] =>
  pts.flatMap((p) => p.slice(1).map((pt, i) => ({ d: line([p[i], pt]), fill: "none" as Paint, stroke: "ink" as Paint, width: width * (1 - 0.24 * i) })));
/** A curved antenna or bristle, mirrored. */
const curves = (d: string, width = 1.8): Shape[] => {
  const m = d.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (_, x, y) => `${100 - Number(x)} ${y}`);
  return [d, m].map((dd) => ({ d: dd, fill: "none" as Paint, stroke: "ink" as Paint, width }));
};
/** Closed shape mirrored about the centre line. */
const mirrorShape = (d: string, fill: Paint, extra: Partial<Shape> = {}): Shape[] => {
  const m = d.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (_, x, y) => `${100 - Number(x)} ${y}`);
  return [d, m].map((dd) => ({ d: dd, fill, stroke: "ink" as Paint, width: 1.6, ...extra }));
};

export const BUG_ART: Record<BugLetter, Shape[]> = {
  // Queen Bee: crowned, fuzzy dark thorax, veined wings, a pointed striped abdomen.
  Q: [
    ...legs(mirror([[[44, 44], [35, 52], [33, 61]], [[45, 50], [37, 60], [37, 69]]]), 2.6),
    ...mirrorShape("M45 41 C36 31 22 26 16 31 C11 36 20 45 44 46Z", "light", { opacity: 0.92 }),
    ...mirrorShape("M45 47 C38 49 30 55 32 60 C35 64 42 57 46 51Z", "light", { opacity: 0.92 }),
    ...curves("M43 43 C35 38 27 34 20 33", 0.9),
    { d: "M50 46 C61 46 66 57 65 67 C64 79 57 89 50 94 C43 89 36 79 35 67 C34 57 39 46 50 46Z", fill: "main", stroke: "ink", width: 2.4 },
    { d: "M36.5 59 Q50 63 63.5 59 L64.6 65.5 Q50 70 35.4 65.5Z", fill: "dark" },
    { d: "M37.5 74 Q50 78 62.5 74 L60 80.5 Q50 84 40 80.5Z", fill: "dark" },
    { d: circle(50, 40, 9), fill: "dark", stroke: "ink", width: 2 },
    { d: "M45 37 Q50 34 55 37 M44 42 Q50 39 56 42", fill: "none", stroke: "main", width: 1.6, opacity: 0.9 },
    { d: "M50 21 C56 21 59 26 58 30 C57 34 54 35 50 35 C46 35 43 34 42 30 C41 26 44 21 50 21Z", fill: "dark", stroke: "ink", width: 2 },
    ...curves("M46 23 C43 17 39 15 36 16", 1.6),
    { d: "M42.5 22 L43.5 11.5 L47.2 16.5 L50 8.5 L52.8 16.5 L56.5 11.5 L57.5 22 Q50 24.5 42.5 22Z", fill: "main", stroke: "ink", width: 1.6 },
  ],
  // Beetle: shield-like pronotum over glossy elytra, mandibles, clubbed antennae.
  B: [
    ...legs(mirror([[[38, 36], [27, 30], [21, 20]], [[33, 54], [21, 52], [12, 58]], [[35, 72], [24, 80], [20, 92]]])),
    ...curves("M45 18 C40 13 36 11 33 6", 1.6),
    ...curves("M46 16 C43 13 43 9 46 7.5", 2.4),
    { d: "M50 41 C64 41 70 52 70 64 C70 79 61 90 50 90 C39 90 30 79 30 64 C30 52 36 41 50 41Z", fill: "main", stroke: "ink", width: 2.4 },
    { d: line([[50, 42], [50, 89]]), fill: "none", stroke: "ink", width: 2 },
    { d: "M37 61 C37 53 40 48 44 47", fill: "none", stroke: "light", width: 3.2, opacity: 0.6 },
    { d: "M36 42 C36 32 42 26.5 50 26.5 C58 26.5 64 32 64 42 C58 45.5 42 45.5 36 42Z", fill: "main", stroke: "ink", width: 2.4 },
    { d: "M50 15 C56 15 59 19 58 24 C57 27.5 54 28.5 50 28.5 C46 28.5 43 27.5 42 24 C41 19 44 15 50 15Z", fill: "ink" },
  ],
  // Grasshopper: long folded wings, a saddle pronotum, big eyes, and the powerful
  // hind legs: thick femurs running back along the body with the shins folded under.
  G: [
    ...legs(mirror([[[44, 31], [36, 32], [32, 25]], [[43, 39], [35, 45], [32, 52]]]), 2.4),
    ...curves("M47 12 C44 5 38 2 31 4", 1.6),
    ...legs(mirror([[[27.5, 84], [21, 60], [17.5, 63]]]), 2.2),
    ...mirrorShape("M41 41 C33 44 27 56 25 72 C24 79 26 86 29 86 C32 86 33 80 33.5 74 C35 61 39 51 43 46Z", "main", { width: 2.2 }),
    ...curves("M29 60 L34 62 M27.5 67 L33 68.5 M27 74 L32 75", 1.1),
    { d: "M50 37 C58 37 60 47 59 60 C58 74 55 84 50 90 C45 84 42 74 41 60 C40 47 42 37 50 37Z", fill: "main", stroke: "ink", width: 2.4 },
    { d: "M50 41 L50 87", fill: "none", stroke: "ink", width: 1.4 },
    { d: "M42 26.5 C42 22.5 58 22.5 58 26.5 L60 40 C55 43.5 45 43.5 40 40Z", fill: "main", stroke: "ink", width: 2.4 },
    { d: "M50 8 C57 8 60.5 13.5 59.5 20 C58.5 24.5 55 26.5 50 26.5 C45 26.5 41.5 24.5 40.5 20 C39.5 13.5 43 8 50 8Z", fill: "main", stroke: "ink", width: 2.4 },
    { d: ellipse(43, 15.5, 3.4, 4.6, 10), fill: "ink" },
    { d: ellipse(57, 15.5, 3.4, 4.6, -10), fill: "ink" },
  ],
  // Spider: a garden spider. Small head-chest, plump abdomen with a pale cross and
  // folium, eight arched and jointed legs, and pedipalps up front.
  S: [
    ...legs(
      mirror([
        [[45, 33], [33, 20], [28, 9]],
        [[43, 37], [26, 27], [13, 25]],
        [[43, 42], [25, 46], [12, 56]],
        [[44, 46], [31, 57], [25, 75]],
      ]),
      3.2,
    ),
    ...curves("M46.5 29 C44.5 25 45 22 47 20.5", 2.4),
    { d: "M50 47 C64 47 71 57 71 67 C71 79 62 89 50 89 C38 89 29 79 29 67 C29 57 36 47 50 47Z", fill: "main", stroke: "ink", width: 2.4 },
    { d: "M50 53 C43 58 38 65 39.5 73 C42 79 46 84 50 86 C54 84 58 79 60.5 73 C62 65 57 58 50 53Z", fill: "dark", opacity: 0.55 },
    { d: "M42.5 64 L50 69 L57.5 64 M44 72.5 L50 77 L56 72.5 M46 80 L50 83 L54 80", fill: "none", stroke: "light", width: 1.8, opacity: 0.9 },
    { d: "M50 56 L50 61", fill: "none", stroke: "light", width: 2.2, opacity: 0.9 },
    { d: "M50 28 C57 28 61 33 61 39 C61 45 56 49 50 49 C44 49 39 45 39 39 C39 33 43 28 50 28Z", fill: "main", stroke: "ink", width: 2.4 },
    { d: circle(47, 32.5, 1.7), fill: "ink" },
    { d: circle(53, 32.5, 1.7), fill: "ink" },
    { d: circle(44.5, 35, 1.2), fill: "ink" },
    { d: circle(55.5, 35, 1.2), fill: "ink" },
  ],
  // Soldier Ant: three clear segments with a pinched waist, elbowed antennae, mandibles.
  A: [
    ...legs(mirror([[[45, 38], [32, 30], [25, 19]], [[45, 44], [30, 46], [19, 53]], [[46, 50], [34, 62], [28, 80]]]), 2.8),
    ...curves("M45.5 15 L39 10 L35 2.5", 1.7),
    ...curves("M46.5 13 C44.5 9.5 46 7 48.5 7.5", 2.2),
    { d: "M50 61 C60 61 65 70 64 78 C63 87 57 92 50 92 C43 92 37 87 36 78 C35 70 40 61 50 61Z", fill: "main", stroke: "ink", width: 2.4 },
    { d: "M38 72.5 Q50 76.5 62 72.5 M37.5 81 Q50 85 62.5 81", fill: "none", stroke: "ink", width: 1.3, opacity: 0.7 },
    { d: ellipse(50, 57.5, 3.4, 3), fill: "main", stroke: "ink", width: 2 },
    { d: "M50 33 C55 33 57 38 56 44 C55 50 53 54 50 54 C47 54 45 50 44 44 C43 38 45 33 50 33Z", fill: "main", stroke: "ink", width: 2.4 },
    { d: "M50 12 C57 12 60 18 59 24 C58 29 54 31 50 31 C46 31 42 29 41 24 C40 18 43 12 50 12Z", fill: "main", stroke: "ink", width: 2.4 },
    { d: ellipse(44.5, 20.5, 1.9, 2.6, 15), fill: "ink" },
    { d: ellipse(55.5, 20.5, 1.9, 2.6, -15), fill: "ink" },
  ],
  // Mosquito: needle proboscis, feathery antennae, narrow veined wings, a long banded
  // abdomen and six very long, banded legs.
  M: [
    ...legs(mirror([[[46, 36], [31, 24], [19, 9]], [[45, 41], [25, 41], [7, 47]], [[46, 46], [31, 63], [23, 85], [21, 95]]]), 2),
    ...mirrorShape("M47 41 C40 45 31 58 29 70 C28.4 75 32 76.5 34 72 C38.5 62 44 51 48 45Z", "light", { opacity: 0.85, width: 1.4 }),
    ...curves("M46 47 C40 53 35 62 32 70", 0.9),
    { d: "M50 48 C54 48 55.5 56 55.5 66 C55.5 78 53 88 50 93 C47 88 44.5 78 44.5 66 C44.5 56 46 48 50 48Z", fill: "main", stroke: "ink", width: 2 },
    { d: "M45 57 Q50 59 55 57 M44.7 65 Q50 67 55.3 65 M45 73 Q50 75 55 73 M46 81 Q50 83 54 81", fill: "none", stroke: "ink", width: 1.3 },
    { d: "M50 31.5 C55 31.5 57.5 35.5 57.5 40.5 C57.5 46 54 49.5 50 49.5 C46 49.5 42.5 46 42.5 40.5 C42.5 35.5 45 31.5 50 31.5Z", fill: "main", stroke: "ink", width: 2 },
    { d: line([[50, 23], [50, 4]]), fill: "none", stroke: "ink", width: 2 },
    ...curves("M47.5 24 C44 19 41 14 39.5 8 M45.5 20 L42 20.5 M44 16.5 L40.5 16.5 M42.5 13 L39 12.5", 1.3),
    { d: circle(50, 27, 5), fill: "ink" },
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
  // Pillbug: overlapping armour plates, a head shield with antennae, short paired legs
  // and tail uropods.
  P: [
    ...legs(mirror([[[32, 42], [23, 38], [20, 34]], [[30, 51], [20, 50], [16, 47]], [[30, 60], [20, 61], [16, 64]], [[32, 69], [23, 73], [20, 77]]]), 2.6),
    ...curves("M43 24 C38 18 34 15 29 15", 2),
    ...curves("M45 80 L41 88", 2.4),
    { d: "M50 25 C63 25 70 36 70 52 C70 70 62 83 50 83 C38 83 30 70 30 52 C30 36 37 25 50 25Z", fill: "main", stroke: "ink", width: 2.4 },
    { d: "M31.5 40 Q50 32 68.5 40 M30.2 49 Q50 41 69.8 49 M30.2 58 Q50 50 69.8 58 M31.5 67 Q50 59 68.5 67 M35 75 Q50 68 65 75", fill: "none", stroke: "ink", width: 2 },
    { d: "M36 38 Q50 31 64 38", fill: "none", stroke: "light", width: 2.4, opacity: 0.5 },
    { d: "M38 30 C40 24 60 24 62 30 C58 33 42 33 38 30Z", fill: "ink" },
  ],
};

export function paintColor(p: Paint, bug: BugLetter, ink: string): string {
  switch (p) {
    case "main":
      return BUG_COLORS[bug];
    case "ink":
      return ink;
    case "light":
      return "#f5f5f3";
    case "dark":
      return "#2c2d30";
    default:
      return "none";
  }
}
