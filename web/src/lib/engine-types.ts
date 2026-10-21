// Mirrors the serde views in engine/src/wasm.rs — keep in sync.

export type ColorCode = "w" | "b";
export type BugLetter = "Q" | "S" | "B" | "G" | "A" | "M" | "L" | "P";
export type GameStatus = "NotStarted" | "InProgress" | "Draw" | "WhiteWins" | "BlackWins";

export interface Rules {
  mosquito: boolean;
  ladybug: boolean;
  pillbug: boolean;
  tournament: boolean;
}

export interface PieceView {
  name: string;
  color: ColorCode;
  bug: BugLetter;
  q: number;
  r: number;
  level: number;
  onTop: boolean;
}

export interface HandView {
  bug: BugLetter;
  count: number;
  next: string | null;
}

export interface MoveView {
  piece: string;
  from: [number, number] | null;
  to: [number, number];
  toLevel: number;
  notation: string;
}

export interface StateView {
  rules: Rules;
  status: GameStatus;
  toMove: ColorCode;
  turn: number;
  ply: number;
  pieces: PieceView[];
  hands: [HandView[], HandView[]];
  legalMoves: MoveView[];
  mustPass: boolean;
  lastMoved: string | null;
  lastMove: MoveView | null;
  history: string[];
  gameString: string;
  queenNeighbors: [number, number];
  repetitions: number;
}

export interface AiResult {
  best: string;
  scoreWhite: number;
  whiteWinProb: number;
  depth: number;
  nodes: number;
  pv: string[];
  engine: string;
}

export type Level = "easy" | "medium" | "hard" | "expert";

export const BUG_NAMES: Record<BugLetter, string> = {
  Q: "Queen Bee",
  S: "Spider",
  B: "Beetle",
  G: "Grasshopper",
  A: "Soldier Ant",
  M: "Mosquito",
  L: "Ladybug",
  P: "Pillbug",
};

export const LEVELS: { id: Level; name: string; blurb: string }[] = [
  { id: "easy", name: "Easy", blurb: "Looks one move ahead and often picks a so-so move." },
  { id: "medium", name: "Medium", blurb: "Looks two moves ahead with a little randomness." },
  { id: "hard", name: "Hard", blurb: "Deep alpha-beta search, about 1.5 seconds per move." },
  { id: "expert", name: "Expert", blurb: "Neural network + tree search when a trained model is installed; otherwise a longer, deeper search." },
];

export function colorName(c: ColorCode) {
  return c === "w" ? "White" : "Black";
}

export function resultText(status: GameStatus): string {
  switch (status) {
    case "WhiteWins":
      return "White wins";
    case "BlackWins":
      return "Black wins";
    case "Draw":
      return "Draw";
    default:
      return "";
  }
}

export function gameTypeString(r: Rules) {
  const ext = (r.mosquito ? "M" : "") + (r.ladybug ? "L" : "") + (r.pillbug ? "P" : "");
  return ext ? `Base+${ext}` : "Base";
}
