import type { HiveTheme } from "./types";
import { pieceAbbrev } from "@/lib/types";

const PIECE_ICONS: Record<string, string> = {
  Queen: "🐝",
  Beetle: "🪲",
  Spider: "🕷️",
  Grasshopper: "🦗",
  Ant: "🐜",
  Mosquito: "🦟",
  Ladybug: "🐞",
  Pillbug: "🐛",
};

export const cleanTheme: HiveTheme = {
  name: "Clean",
  id: "clean",
  board: {
    background: "#0f172a",
    gridLineColor: "#334155",
    gridLineWidth: 1.5,
    highlightColor: "rgba(245, 158, 11, 0.35)",
    selectedColor: "rgba(59, 130, 246, 0.5)",
    lastMoveColor: "rgba(34, 197, 94, 0.25)",
  },
  pieces: {
    whiteColor: "#e2e8f0",
    blackColor: "#1e293b",
    whiteBorder: "#94a3b8",
    blackBorder: "#475569",
    borderWidth: 2,
    textColor: (color) => (color === "White" ? "#0f172a" : "#e2e8f0"),
    fontSize: 20,
    renderLabel: (type) => PIECE_ICONS[type] || pieceAbbrev(type),
  },
  animations: {
    enabled: true,
    durationMs: 200,
  },
};
