import type { GameMove, RuleConfig } from "./types";

export interface GameRecord {
  version: 1;
  id: string; // unique ID for each game
  name: string; // user-visible name (editable)
  metadata: {
    date: string; // ISO string
    whitePlayer: string;
    blackPlayer: string;
    result: string; // "WhiteWins" | "BlackWins" | "Draw" | "InProgress"
    totalMoves: number;
    rules: RuleConfig;
  };
  moves: GameMove[];
}

const STORAGE_KEY = "hive-game-recordings";
const COUNTER_KEY = "hive-game-counter";

function nextGameNumber(): number {
  try {
    const n = parseInt(localStorage.getItem(COUNTER_KEY) || "0", 10) + 1;
    localStorage.setItem(COUNTER_KEY, String(n));
    return n;
  } catch {
    return Date.now();
  }
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createGameRecord(rules: RuleConfig, whitePlayer: string, blackPlayer: string): GameRecord {
  const num = nextGameNumber();
  return {
    version: 1,
    id: generateId(),
    name: `Game ${num}`,
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

export function renameRecord(record: GameRecord, name: string): GameRecord {
  return { ...record, name };
}

// localStorage persistence — saves/updates by ID
export function saveRecordToStorage(record: GameRecord): void {
  try {
    const existing = loadRecordsFromStorage();
    const idx = existing.findIndex((r) => r.id === record.id);
    if (idx >= 0) {
      existing[idx] = record;
    } else {
      existing.push(record);
    }
    // Keep last 50 games
    const trimmed = existing.slice(-50);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch { /* localStorage may be unavailable */ }
}

export function deleteRecordFromStorage(id: string): void {
  try {
    const existing = loadRecordsFromStorage();
    const filtered = existing.filter((r) => r.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch { /* localStorage may be unavailable */ }
}

export function loadRecordsFromStorage(): GameRecord[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    const records = JSON.parse(data) as GameRecord[];
    // Migrate old records that lack id/name
    return records.map((r, i) => ({
      ...r,
      id: r.id || `legacy-${i}`,
      name: r.name || `Game ${i + 1}`,
    }));
  } catch { return []; }
}

// File export/import
export function exportRecord(record: GameRecord): void {
  const blob = new Blob([JSON.stringify(record, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const safeName = record.name.replace(/[^a-zA-Z0-9_-]/g, "-").toLowerCase();
  a.download = `${safeName}.hive`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importRecord(file: File): Promise<GameRecord> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const record = JSON.parse(reader.result as string) as GameRecord;
        if (!record.moves || !record.metadata) {
          reject(new Error("Invalid .hive file format"));
          return;
        }
        // Ensure id and name exist
        resolve({
          ...record,
          version: 1,
          id: record.id || generateId(),
          name: record.name || file.name.replace(/\.(hive|json)$/, ""),
        });
      } catch {
        reject(new Error("Failed to parse .hive file"));
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file);
  });
}
