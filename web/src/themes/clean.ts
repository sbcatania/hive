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

export const natureTheme: HiveTheme = {
  name: "Nature",
  id: "nature",
  board: {
    background: "#1a2e1a",
    gridLineColor: "#3a5a3a",
    gridLineWidth: 1.5,
    highlightColor: "rgba(212, 160, 23, 0.4)",
    selectedColor: "rgba(76, 175, 80, 0.55)",
    lastMoveColor: "rgba(139, 195, 74, 0.3)",
  },
  pieces: {
    whiteColor: "#f5f0e0",
    blackColor: "#3d2b1f",
    whiteBorder: "#b8a882",
    blackBorder: "#6d4c2f",
    borderWidth: 2,
    textColor: (color) => (color === "White" ? "#2e1a0e" : "#f5f0e0"),
    fontSize: 20,
    renderLabel: (type) => PIECE_ICONS[type] || pieceAbbrev(type),
  },
  animations: {
    enabled: true,
    durationMs: 200,
  },
};
