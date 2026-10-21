import type { ColorCode, Level, Rules } from "./engine-types";

export type LocalMode = "cpu" | "local";

export interface LocalSettings {
  mode: LocalMode;
  rules: Rules;
  level: Level;
  /** The human's colour in CPU games. */
  human: ColorCode;
}

export interface SavedGame {
  settings: LocalSettings;
  moves: string[];
  result?: "WhiteWins" | "BlackWins" | "Draw";
  resultReason?: string;
}

export const DEFAULT_RULES: Rules = { mosquito: true, ladybug: true, pillbug: true, tournament: true };

export function settingsToQuery(s: LocalSettings) {
  const exp = (s.rules.mosquito ? "M" : "") + (s.rules.ladybug ? "L" : "") + (s.rules.pillbug ? "P" : "");
  const q = new URLSearchParams({ mode: s.mode, exp: exp || "none", t: s.rules.tournament ? "1" : "0" });
  if (s.mode === "cpu") {
    q.set("level", s.level);
    q.set("color", s.human);
  }
  return q.toString();
}

export function settingsFromQuery(q: URLSearchParams): LocalSettings | null {
  const mode = q.get("mode");
  if (mode !== "cpu" && mode !== "local") return null;
  const exp = q.get("exp") ?? "MLP";
  const level = (q.get("level") ?? "medium") as Level;
  let human = (q.get("color") ?? "w") as ColorCode | "random";
  if (human === "random") human = Math.random() < 0.5 ? "w" : "b";
  return {
    mode,
    rules: { mosquito: exp.includes("M"), ladybug: exp.includes("L"), pillbug: exp.includes("P"), tournament: q.get("t") !== "0" },
    level: ["easy", "medium", "hard", "expert"].includes(level) ? level : "medium",
    human: human === "b" ? "b" : "w",
  };
}

const SAVE_KEY = "hive.saved-game";

export function loadSavedGame(): SavedGame | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? (JSON.parse(raw) as SavedGame) : null;
  } catch {
    return null;
  }
}

export function saveGame(g: SavedGame) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(g));
  } catch {}
}

const PREFS_KEY = "hive.setup";

export function loadSetupPrefs<T>(fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

export function saveSetupPrefs(v: unknown) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(v));
  } catch {}
}
