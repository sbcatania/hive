export type ThemeId = "bakelite" | "field" | "clean" | "3d";

export interface ThemeInfo {
  id: ThemeId;
  name: string;
  blurb: string;
}

export const THEMES: ThemeInfo[] = [
  { id: "field", name: "Sketchbook", blurb: "Ink and watercolour on graph paper." },
  { id: "bakelite", name: "Bakelite", blurb: "Glossy bevelled tiles, like the real game." },
  { id: "clean", name: "Clean", blurb: "Flat and high-contrast. Easiest to read on small screens." },
  { id: "3d", name: "3D", blurb: "Moulded tiles with engraved bugs on a sheet of paper. Drag to orbit, pinch or scroll to zoom." },
];

export interface TilePalette {
  fill: string;
  edge: string;
  side: string;
  ink: string;
  gradient: [string, string];
  shine: string;
}

export const TILE: Record<"w" | "b", TilePalette> = {
  w: { fill: "#f6f0e2", edge: "#b8ab8c", side: "#cdbf9f", ink: "#24201b", gradient: ["#fffdf7", "#e4d9bf"], shine: "#ffffff" },
  b: { fill: "#2b2b30", edge: "#0b0b0d", side: "#141417", ink: "#f2eee4", gradient: ["#4a4a52", "#1b1b1f"], shine: "#9a9aa6" },
};

const KEY = "hive.board-style.v2";

export function loadTheme(): ThemeId {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "bakelite" || v === "field" || v === "clean" || v === "3d") return v;
  } catch {}
  return "field";
}

export function saveTheme(t: ThemeId) {
  try {
    localStorage.setItem(KEY, t);
  } catch {}
}

/** Rounded-corner hexagon (pointy top) as an SVG path. */
export function roundedHexPath(cx: number, cy: number, r: number, corner = 0.18): string {
  const pts = Array.from({ length: 6 }, (_, i) => {
    const a = ((60 * i - 90) * Math.PI) / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const;
  });
  const k = corner;
  let d = "";
  for (let i = 0; i < 6; i++) {
    const [px, py] = pts[(i + 5) % 6];
    const [x, y] = pts[i];
    const [nx, ny] = pts[(i + 1) % 6];
    const ax = x + (px - x) * k;
    const ay = y + (py - y) * k;
    const bx = x + (nx - x) * k;
    const by = y + (ny - y) * k;
    d += `${i === 0 ? "M" : "L"}${ax.toFixed(2)} ${ay.toFixed(2)} Q${x.toFixed(2)} ${y.toFixed(2)} ${bx.toFixed(2)} ${by.toFixed(2)} `;
  }
  return d + "Z";
}
