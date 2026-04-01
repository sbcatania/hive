import type { HiveTheme } from "./types";
import { pieceAbbrev } from "@/lib/types";

export const arcticTheme: HiveTheme = {
  name: "Arctic",
  id: "arctic",
  board: {
    background: "#0a1628",
    gridLineColor: "#1a2a4a",
    gridLineWidth: 1,
    highlightColor: "rgba(0, 188, 212, 0.35)",
    selectedColor: "rgba(79, 195, 247, 0.5)",
    lastMoveColor: "rgba(100, 181, 246, 0.25)",
  },
  pieces: {
    whiteColor: "#e8f0fe",
    blackColor: "#2d3e5e",
    whiteBorder: "#90b4e0",
    blackBorder: "#4a6a9a",
    borderWidth: 1.5,
    textColor: (color) => (color === "White" ? "#0a1628" : "#e8f0fe"),
    fontSize: 16,
    renderLabel: (type) => pieceAbbrev(type),
  },
  animations: {
    enabled: false,
    durationMs: 0,
  },
};
