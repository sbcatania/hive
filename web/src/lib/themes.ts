export type ThemeId = "field" | "3d";

export interface ThemeInfo {
  id: ThemeId;
  name: string;
  blurb: string;
}

export const THEMES: ThemeInfo[] = [
  { id: "field", name: "Sketch", blurb: "Ink and watercolour on graph paper." },
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
    if (v === "3d") return v;
  } catch {}
  return "field";
}

export function saveTheme(t: ThemeId) {
  try {
    localStorage.setItem(KEY, t);
  } catch {}
}
