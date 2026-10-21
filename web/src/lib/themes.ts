export type ThemeId = "flat" | "tiles" | "3d";

export interface ThemeInfo {
  id: ThemeId;
  name: string;
  blurb: string;
}

export const THEMES: ThemeInfo[] = [
  { id: "flat", name: "Clean 2D", blurb: "Crisp flat hexagons. Fast and phone-friendly." },
  { id: "tiles", name: "Classic tiles", blurb: "Bevelled tiles that look like the physical game." },
  { id: "3d", name: "3D", blurb: "Rotatable 3D board. Drag to orbit, scroll to zoom." },
];

export interface TilePalette {
  fill: string;
  edge: string;
  side: string;
  ink: string;
  gradient: [string, string];
}

export const TILE: Record<"w" | "b", TilePalette> = {
  w: { fill: "#f7f2e6", edge: "#bdb39c", side: "#cfc5ad", ink: "#232020", gradient: ["#fffdf6", "#e6dcc4"] },
  b: { fill: "#2a2a2e", edge: "#0d0d10", side: "#121215", ink: "#f2eee4", gradient: ["#45454b", "#1c1c20"] },
};

const KEY = "hive.theme";

export function loadTheme(): ThemeId {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "flat" || v === "tiles" || v === "3d") return v;
  } catch {}
  return "flat";
}

export function saveTheme(t: ThemeId) {
  try {
    localStorage.setItem(KEY, t);
  } catch {}
}
