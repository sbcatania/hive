// The journal: every CPU and pass-and-play game, saved in this browser and,
// when signed in, mirrored to the account (table saved_games).
import {
  levelInfo,
  normalizeRules,
  type ColorCode,
  type Level,
  type Rules,
} from "./engine-types";
import { sb, supabaseAvailable } from "./supabase";

export type JournalMode = "cpu" | "local";
export type GameResult = "WhiteWins" | "BlackWins" | "Draw";

export interface ClockSettings {
  /** Starting time per player in ms; null = untimed. */
  baseMs: number | null;
  incMs: number;
}

export interface JournalEntry {
  id: string;
  mode: JournalMode;
  rules: Rules;
  moves: string[];
  result?: GameResult;
  resultReason?: string;
  /** e.g. "vs Sable the Spider" or "Pass & play". */
  label: string;
  /** The human's colour in CPU games. */
  human: ColorCode;
  level?: Level;
  clock?: ClockSettings;
  /** Remaining clock times [white, black] in ms, for resuming timed games. */
  clockLeft?: [number, number];
  /** Whether hints and the evaluation bar are allowed in this game (default yes). */
  assists?: boolean;
  /** Help used during the game. A win with none of it is a clean win. */
  hintsUsed?: number;
  takebacks?: number;
  evalUsed?: boolean;
  createdAt: number;
  updatedAt: number;
}

const KEY = "hive.journal";
const CURRENT = "hive.journal.current";
const MAX = 150;

function read(): JournalEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as JournalEntry[]) : [];
    return list.map((e) => ({ ...e, rules: normalizeRules(e.rules) }));
  } catch {
    return [];
  }
}

function write(list: JournalEntry[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {}
}

export function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function listLocal(): JournalEntry[] {
  return read().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getLocal(id: string) {
  return read().find((e) => e.id === id) ?? null;
}

export function saveLocal(entry: JournalEntry) {
  const list = read().filter((e) => e.id !== entry.id);
  list.unshift(entry);
  write(list);
}

export function deleteLocal(id: string) {
  write(read().filter((e) => e.id !== id));
}

export function currentGameId(): string | null {
  try {
    return localStorage.getItem(CURRENT);
  } catch {
    return null;
  }
}

export function setCurrentGameId(id: string | null) {
  try {
    if (id) localStorage.setItem(CURRENT, id);
    else localStorage.removeItem(CURRENT);
  } catch {}
}

/** The most recent unfinished game, if any. */
export function resumable(): JournalEntry | null {
  const id = currentGameId();
  const e = id ? getLocal(id) : null;
  return e && !e.result && e.moves.length > 0 ? e : null;
}

// ---- Cloud ------------------------------------------------------------------

interface CloudRow {
  id: string;
  local_id: string;
  mode: JournalMode;
  rules: Rules;
  moves: string[];
  result: GameResult | null;
  result_reason: string | null;
  label: string | null;
  human_color: ColorCode | null;
  meta?: Partial<
    Pick<
      JournalEntry,
      "level" | "clock" | "assists" | "hintsUsed" | "takebacks" | "evalUsed"
    >
  > | null;
  created_at: string;
  updated_at: string;
}

function fromRow(r: CloudRow): JournalEntry {
  return {
    id: r.local_id,
    mode: r.mode,
    rules: normalizeRules(r.rules),
    moves: r.moves,
    result: r.result ?? undefined,
    resultReason: r.result_reason ?? undefined,
    label: r.label ?? "",
    human: r.human_color ?? "w",
    ...(r.meta ?? {}),
    createdAt: new Date(r.created_at).getTime(),
    updatedAt: new Date(r.updated_at).getTime(),
  };
}

let cloudHasMeta = true;

export async function saveCloud(userId: string, e: JournalEntry) {
  if (!supabaseAvailable() || e.moves.length === 0) return;
  const meta = {
    level: e.level,
    clock: e.clock,
    assists: e.assists,
    hintsUsed: e.hintsUsed,
    takebacks: e.takebacks,
    evalUsed: e.evalUsed,
  };
  const row = {
    user_id: userId,
    local_id: e.id,
    mode: e.mode,
    rules: e.rules,
    moves: e.moves,
    result: e.result ?? null,
    result_reason: e.resultReason ?? null,
    label: e.label,
    human_color: e.human,
    created_at: new Date(e.createdAt).toISOString(),
    updated_at: new Date(e.updatedAt).toISOString(),
  };
  // The meta column arrives with a later migration; until then save without it.
  if (cloudHasMeta) {
    const { error } = await sb()
      .from("saved_games")
      .upsert({ ...row, meta }, { onConflict: "user_id,local_id" });
    if (!error) return;
    if (!/meta/.test(error.message)) throw new Error(error.message);
    cloudHasMeta = false;
  }
  await sb()
    .from("saved_games")
    .upsert(row, { onConflict: "user_id,local_id" });
}

/** Hints, takebacks or the evaluation bar were used. */
export function assisted(
  e: Pick<JournalEntry, "hintsUsed" | "takebacks" | "evalUsed">,
) {
  return (e.hintsUsed ?? 0) > 0 || (e.takebacks ?? 0) > 0 || !!e.evalUsed;
}

/** "2 hints, 1 takeback" or "no help". */
export function assistText(
  e: Pick<JournalEntry, "hintsUsed" | "takebacks" | "evalUsed" | "assists">,
) {
  const parts: string[] = [];
  const h = e.hintsUsed ?? 0;
  const t = e.takebacks ?? 0;
  if (h) parts.push(`${h} hint${h === 1 ? "" : "s"}`);
  if (t) parts.push(`${t} takeback${t === 1 ? "" : "s"}`);
  if (e.evalUsed) parts.push("evaluation shown");
  return parts.length
    ? parts.join(", ")
    : e.assists === false
      ? "no help (hints off)"
      : "no help";
}

export async function listCloud(): Promise<JournalEntry[]> {
  const { data, error } = await sb()
    .from("saved_games")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return (data as CloudRow[]).map(fromRow);
}

export async function deleteCloud(localId: string) {
  await sb().from("saved_games").delete().eq("local_id", localId);
}

/** Copies every local game with moves to the account. */
export async function uploadAllLocal(userId: string) {
  const list = listLocal().filter((e) => e.moves.length > 0);
  for (const e of list) await saveCloud(userId, e);
  return list.length;
}

/** One-time migration from the single saved game of the first version. */
export function migrateLegacySave() {
  try {
    const raw = localStorage.getItem("hive.saved-game");
    if (!raw) return;
    const old = JSON.parse(raw) as {
      settings: {
        mode: JournalMode;
        rules: Rules;
        level: Level;
        human: ColorCode;
      };
      moves: string[];
      result?: GameResult;
      resultReason?: string;
    };
    if (old.moves?.length) {
      const now = Date.now();
      const id = newId();
      saveLocal({
        id,
        mode: old.settings.mode,
        rules: normalizeRules(old.settings.rules),
        moves: old.moves,
        result: old.result,
        resultReason: old.resultReason,
        label: old.settings.mode === "cpu" ? "vs Computer" : "Pass & play",
        human: old.settings.human,
        level: old.settings.level,
        createdAt: now,
        updatedAt: now,
      });
      if (!old.result) setCurrentGameId(id);
    }
    localStorage.removeItem("hive.saved-game");
  } catch {}
}

/** "You won" / "You lost" / "Draw" (CPU games) or "White won" etc. (pass & play). */
export function resultLabel(
  e: Pick<JournalEntry, "mode" | "result" | "human">,
): string {
  if (!e.result) return "In progress";
  if (e.result === "Draw") return "Draw";
  const whiteWon = e.result === "WhiteWins";
  if (e.mode === "local") return whiteWon ? "White won" : "Black won";
  return whiteWon === (e.human === "w") ? "You won" : "You lost";
}

export const REASON_TEXT: Record<string, string> = {
  surround: "by surrounding the Queen",
  resignation: "by resignation",
  agreement: "by agreement",
  time: "on time",
  repetition: "by threefold repetition",
  "turn-limit": "at the turn limit",
};

/** "White wins by resignation", "Draw by agreement". */
export function resultSentence(result: string, reason?: string | null) {
  const head =
    result === "WhiteWins"
      ? "White wins"
      : result === "BlackWins"
        ? "Black wins"
        : "Draw";
  const why = REASON_TEXT[reason ?? ""];
  return why ? `${head} ${why}` : head;
}

/** A human-readable title for a saved game. CPU games are named by level, which also
 * tidies labels from older versions that used character names. */
export function gameTitle(e: Pick<JournalEntry, "mode" | "level" | "label">) {
  if (e.mode === "cpu")
    return e.level ? `vs Computer (${levelInfo(e.level).name})` : "vs Computer";
  return e.label || (e.mode === "local" ? "Pass & play" : "Game");
}
