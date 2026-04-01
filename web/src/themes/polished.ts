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

export const emberTheme: HiveTheme = {
  name: "Ember",
  id: "ember",
  board: {
    background: "#1a1a1a",
    gridLineColor: "#3d1f1f",
    gridLineWidth: 1,
    highlightColor: "rgba(255, 109, 0, 0.4)",
    selectedColor: "rgba(255, 23, 68, 0.5)",
    lastMoveColor: "rgba(255, 152, 0, 0.3)",
  },
  pieces: {
    whiteColor: "#ffe0b2",
    blackColor: "#6d1b1b",
    whiteBorder: "#ff8a65",
    blackBorder: "#a04040",
    borderWidth: 2.5,
    textColor: (color) => (color === "White" ? "#3e1a00" : "#ffe0b2"),
    fontSize: 22,
    renderLabel: (type) => PIECE_ICONS[type] || pieceAbbrev(type),
  },
  animations: {
    enabled: true,
    durationMs: 350,
  },
};
