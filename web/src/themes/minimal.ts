import type { HiveTheme } from "./types";
import { pieceAbbrev } from "@/lib/types";

export const minimalTheme: HiveTheme = {
  name: "Minimal",
  id: "minimal",
  board: {
    background: "#fafafa",
    gridLineColor: "#d4d4d8",
    gridLineWidth: 1,
    highlightColor: "rgba(234, 179, 8, 0.3)",
    selectedColor: "rgba(37, 99, 235, 0.3)",
    lastMoveColor: "rgba(22, 163, 74, 0.2)",
  },
  pieces: {
    whiteColor: "#ffffff",
    blackColor: "#27272a",
    whiteBorder: "#a1a1aa",
    blackBorder: "#52525b",
    borderWidth: 1.5,
    textColor: (color) => (color === "White" ? "#18181b" : "#fafafa"),
    fontSize: 16,
    renderLabel: (type) => pieceAbbrev(type),
  },
  animations: {
    enabled: false,
    durationMs: 0,
  },
};
