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

export const polishedTheme: HiveTheme = {
  name: "Polished",
  id: "polished",
  board: {
    background: "#0c0a09",
    gridLineColor: "#44403c",
    gridLineWidth: 1,
    highlightColor: "rgba(251, 191, 36, 0.4)",
    selectedColor: "rgba(96, 165, 250, 0.5)",
    lastMoveColor: "rgba(74, 222, 128, 0.3)",
  },
  pieces: {
    whiteColor: "#fef3c7",
    blackColor: "#292524",
    whiteBorder: "#d97706",
    blackBorder: "#78716c",
    borderWidth: 2.5,
    textColor: (color) => (color === "White" ? "#451a03" : "#fef3c7"),
    fontSize: 22,
    renderLabel: (type) => PIECE_ICONS[type] || pieceAbbrev(type),
  },
  animations: {
    enabled: true,
    durationMs: 350,
  },
};
