// Mirrors the serde views in engine/src/wasm.rs — keep in sync.

export type ColorCode = "w" | "b";
export type BugLetter = "Q" | "S" | "B" | "G" | "A" | "M" | "L" | "P";
export type GameStatus = "NotStarted" | "InProgress" | "Draw" | "WhiteWins" | "BlackWins";

export interface Rules {
  mosquito: boolean;
  ladybug: boolean;
  pillbug: boolean;
  tournament: boolean;
  /** Pieces per player of each bug in BUG_ORDER (variants may lower these). */
  counts: number[];
  queenDeadline: number;
  surround: number;
  turnLimit: number;
  repetitionDraw: boolean;
}

export const BUG_ORDER: BugLetter[] = ["Q", "S", "B", "G", "A", "M", "L", "P"];
export const STANDARD_COUNTS = [1, 2, 2, 3, 3, 1, 1, 1];

export function standardRules(partial: Partial<Rules> = {}): Rules {
  return {
    mosquito: true,
    ladybug: true,
    pillbug: true,
    tournament: true,
    counts: [...STANDARD_COUNTS],
    queenDeadline: 4,
    surround: 6,
    turnLimit: 0,
    repetitionDraw: false,
    ...partial,
  };
}

/** Fills in fields missing from older saved settings. */
export function normalizeRules(r: Partial<Rules>): Rules {
  return standardRules(Object.fromEntries(Object.entries(r).filter(([, v]) => v !== undefined)) as Partial<Rules>);
}

export function isStandardRules(r: Rules) {
  return r.counts.every((c, i) => c >= STANDARD_COUNTS[i]) && r.queenDeadline === 4 && r.surround === 6 && r.turnLimit === 0 && !r.repetitionDraw;
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
  endReason: "surround" | "repetition" | "turn-limit" | null;
  standardRules: boolean;
}

export interface PreviewView {
  /** True when these are legal moves right now; false = where it could go next turn. */
  legal: boolean;
  moves: MoveView[];
  reason: string | null;
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

export interface Persona {
  id: Level;
  name: string;
  bug: BugLetter;
  title: string;
  temperament: string;
  /** Rough playing strength, shown on the card. */
  strength: number;
}

/** CPU opponents. Each level is a named bug with a temperament. */
export const LEVELS: Persona[] = [
  { id: "easy", name: "Pip", bug: "P", title: "the Pillbug", temperament: "Rolls around cheerfully. Looks one move ahead and often misses danger.", strength: 1 },
  { id: "medium", name: "Greta", bug: "G", title: "the Grasshopper", temperament: "Jumps at any chance she sees. Looks two moves ahead, a little impulsive.", strength: 2 },
  { id: "hard", name: "Sable", bug: "S", title: "the Spider", temperament: "Patient and precise. Searches deeply for about a second and a half.", strength: 3 },
  { id: "expert", name: "Regina", bug: "Q", title: "the Queen", temperament: "Ruthless. Her deepest search, or a trained neural network when one is installed.", strength: 4 },
];

export function persona(level: Level) {
  return LEVELS.find((l) => l.id === level) ?? LEVELS[1];
}

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
