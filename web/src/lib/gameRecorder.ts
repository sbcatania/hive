import type { GameMove, RuleConfig } from "./types";

export interface GameRecord {
  version: 1;
  metadata: {
    date: string; // ISO string
    whitePlayer: string; // "Human" or AI config description
    blackPlayer: string;
    result: string; // "WhiteWins" | "BlackWins" | "Draw" | "InProgress"
    totalMoves: number;
    rules: RuleConfig;
  };
  moves: GameMove[];
}

const STORAGE_KEY = "hive-game-recordings";

export function createGameRecord(rules: RuleConfig, whitePlayer: string, blackPlayer: string): GameRecord {
  return {
    version: 1,
    metadata: {
      date: new Date().toISOString(),
      whitePlayer,
      blackPlayer,
      result: "InProgress",
      totalMoves: 0,
      rules,
    },
    moves: [],
  };
}

export function recordMove(record: GameRecord, move: GameMove): GameRecord {
  return {
    ...record,
    moves: [...record.moves, move],
    metadata: { ...record.metadata, totalMoves: record.metadata.totalMoves + 1 },
  };
}

export function finalizeRecord(record: GameRecord, result: string): GameRecord {
  return { ...record, metadata: { ...record.metadata, result } };
}

// localStorage persistence
export function saveRecordToStorage(record: GameRecord): void {
  try {
    const existing = loadRecordsFromStorage();
    existing.push(record);
    // Keep last 50 games
    const trimmed = existing.slice(-50);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch { /* localStorage may be unavailable */ }
}

export function loadRecordsFromStorage(): GameRecord[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch { return []; }
}

// File export/import
export function exportRecord(record: GameRecord): void {
  const blob = new Blob([JSON.stringify(record, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `hive-game-${record.metadata.date.slice(0, 10)}.hive`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importRecord(file: File): Promise<GameRecord> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const record = JSON.parse(reader.result as string) as GameRecord;
        if (record.version !== 1 || !record.moves || !record.metadata) {
          reject(new Error("Invalid .hive file format"));
        }
        resolve(record);
      } catch {
        reject(new Error("Failed to parse .hive file"));
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file);
  });
}
