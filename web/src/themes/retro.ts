import type { HiveTheme } from "./types";
import { pieceAbbrev } from "@/lib/types";

export const retroTheme: HiveTheme = {
  name: "Retro",
  id: "retro",
  board: {
    background: "#0a0f0a",
    gridLineColor: "#1a2f1a",
    gridLineWidth: 1,
    highlightColor: "rgba(0, 255, 255, 0.35)",
    selectedColor: "rgba(255, 0, 255, 0.5)",
    lastMoveColor: "rgba(255, 255, 255, 0.3)",
  },
  pieces: {
    whiteColor: "#33ff33",
    blackColor: "#ffaa00",
    whiteBorder: "#22cc22",
    blackBorder: "#cc8800",
    borderWidth: 2,
    textColor: (color) => (color === "White" ? "#0a0f0a" : "#0a0f0a"),
    fontSize: 18,
    renderLabel: (type) => pieceAbbrev(type),
  },
  animations: {
    enabled: true,
    durationMs: 150,
  },
};
