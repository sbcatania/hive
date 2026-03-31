import type { PieceType, Color } from "@/lib/types";

export interface HiveTheme {
  name: string;
  id: string;
  board: {
    background: string;
    gridLineColor: string;
    gridLineWidth: number;
    highlightColor: string;
    selectedColor: string;
    lastMoveColor: string;
  };
  pieces: {
    whiteColor: string;
    blackColor: string;
    whiteBorder: string;
    blackBorder: string;
    borderWidth: number;
    textColor: (color: Color) => string;
    fontSize: number;
    renderLabel: (type: PieceType) => string;
  };
  animations: {
    enabled: boolean;
    durationMs: number;
  };
}
