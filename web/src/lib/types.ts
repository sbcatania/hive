/// TypeScript types mirroring the Rust engine's data structures.

export type PieceType =
  | "Queen"
  | "Beetle"
  | "Spider"
  | "Grasshopper"
  | "Ant"
  | "Mosquito"
  | "Ladybug"
  | "Pillbug";

export type Color = "White" | "Black";

export interface Piece {
  piece_type: PieceType;
  color: Color;
  id: number;
}

export type Coord = [number, number]; // [q, r] axial

export interface Board {
  grid: Record<string, Piece[]>; // JSON serializes HashMap as object with string keys
}

export type UndoMode = "None" | "LastMoveOnly" | "FullUndoRedo";

export interface RuleConfig {
  use_mosquito: boolean;
  use_ladybug: boolean;
  use_pillbug: boolean;
  tournament_opening: boolean;
  queen_deadline: number | null;
  undo_mode: UndoMode;
  time_control: number | null;
  piece_counts: Record<PieceType, number>;
}

export type GameStatus = "InProgress" | "WhiteWins" | "BlackWins" | "Draw";

export interface GameState {
  board: Board;
  hands: [Record<PieceType, number>, Record<PieceType, number>];
  turn: number;
  current_player: Color;
  rules: RuleConfig;
  history: HistoryEntry[];
  redo_stack: HistoryEntry[];
  last_move: GameMove | null;
  status: GameStatus;
  time_remaining: [number | null, number | null];
}

export interface HistoryEntry {
  action: GameMove;
  player: Color;
  prev_last_move: GameMove | null;
}

export type GameMove =
  | { Place: { piece_type: PieceType; to: Coord } }
  | { Move: { from: Coord; to: Coord } }
  | { PillbugThrow: { pillbug_at: Coord; target: Coord; to: Coord } }
  | "Pass";

export type Difficulty =
  | "Beginner"
  | "Easy"
  | "Medium"
  | "Hard"
  | "Expert"
  | "Adaptive";

export type AiEngine = "Minimax" | "Mcts";

export interface EvalWeights {
  queen_danger_per_neighbor: number;
  queen_attack_per_neighbor: number;
  mobility_per_move: number;
  hand_piece_value: number;
  beetle_near_queen_bonus: number;
  ant_on_board_bonus: number;
}

export interface AiConfig {
  engine: AiEngine;
  difficulty: Difficulty;
  adaptive_history: boolean[];
  custom_weights?: EvalWeights | null;
}

export interface GamePreset {
  name: string;
  description: string;
  rules: RuleConfig;
}

// Analysis types
export type MoveClassification = "Brilliant" | "Best" | "Good" | "Inaccuracy" | "Mistake" | "Blunder";

export interface PositionEval {
  score: number;
  winProbability: number;
  stats: PositionStats;
}

export interface PositionStats {
  yourQueenNeighbors: number;
  opponentQueenNeighbors: number;
  yourMoves: number;
  opponentMoves: number;
  yourHandPieces: number;
  opponentHandPieces: number;
  yourBoardPieces: number;
  opponentBoardPieces: number;
  yourAntsOnBoard: number;
  beetlesNearOpponentQueen: number;
}

export interface MoveAnalysis {
  classification: MoveClassification;
  scoreBefore: number;
  scoreAfter: number;
  bestScore: number;
  delta: number;
  winProbBefore: number;
  winProbAfter: number;
}

// Hex coordinate helpers
export const DIRECTIONS: Coord[] = [
  [1, 0],   // East
  [-1, 0],  // West
  [0, 1],   // Southeast
  [0, -1],  // Northwest
  [1, -1],  // Northeast
  [-1, 1],  // Southwest
];

export function hexNeighbors(coord: Coord): Coord[] {
  return DIRECTIONS.map(([dq, dr]) => [coord[0] + dq, coord[1] + dr]);
}

/// Convert axial coordinates to pixel position for SVG rendering.
/// Using flat-top hexagons.
export function axialToPixel(q: number, r: number, size: number): { x: number; y: number } {
  const x = size * (3 / 2 * q);
  const y = size * (Math.sqrt(3) / 2 * q + Math.sqrt(3) * r);
  return { x, y };
}

/// Generate SVG points for a flat-top hexagon.
export function hexPoints(cx: number, cy: number, size: number): string {
  const points: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i);
    const px = cx + size * Math.cos(angle);
    const py = cy + size * Math.sin(angle);
    points.push(`${px},${py}`);
  }
  return points.join(" ");
}

/// Parse a board grid key like "0,1" back to a Coord.
export function parseCoordKey(key: string): Coord {
  const parts = key.split(",");
  if (parts.length !== 2) throw new Error(`Invalid coord key: ${key}`);
  return [parseInt(parts[0].trim()), parseInt(parts[1].trim())];
}

/// Format a coord as a grid key string matching Rust serialization.
export function coordKey(coord: Coord): string {
  return `${coord[0]},${coord[1]}`;
}

/// Get the piece type abbreviation for display.
export function pieceAbbrev(type: PieceType): string {
  switch (type) {
    case "Queen": return "Q";
    case "Beetle": return "B";
    case "Spider": return "S";
    case "Grasshopper": return "G";
    case "Ant": return "A";
    case "Mosquito": return "M";
    case "Ladybug": return "L";
    case "Pillbug": return "P";
  }
}
