// Online games through Supabase: a public `games` row per game, realtime
// updates, and token-checked RPCs for every write (see supabase/migrations).
import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";
import { gameTypeString, type ColorCode, type GameStatus, type Rules } from "./engine-types";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function onlineAvailable() {
  return !!(URL && KEY);
}

let client: SupabaseClient | null = null;
function sb() {
  if (!URL || !KEY) throw new Error("Online play is not configured.");
  if (!client) client = createClient(URL, KEY, { auth: { persistSession: false } });
  return client;
}

export const TIME_CONTROLS: { id: string; name: string; baseMs: number | null; incMs: number }[] = [
  { id: "none", name: "Untimed", baseMs: null, incMs: 0 },
  { id: "3+2", name: "3 min + 2s", baseMs: 3 * 60_000, incMs: 2000 },
  { id: "5+5", name: "5 min + 5s", baseMs: 5 * 60_000, incMs: 5000 },
  { id: "10+10", name: "10 min + 10s", baseMs: 10 * 60_000, incMs: 10_000 },
  { id: "20+20", name: "20 min + 20s", baseMs: 20 * 60_000, incMs: 20_000 },
];

export interface OnlineGame {
  id: string;
  created_at: string;
  updated_at: string;
  game_type: string;
  tournament: boolean;
  moves: string[];
  status: "waiting" | "active" | "finished";
  result: Exclude<GameStatus, "NotStarted" | "InProgress"> | null;
  result_reason: string | null;
  white_joined: boolean;
  black_joined: boolean;
  base_ms: number | null;
  increment_ms: number;
  white_ms: number | null;
  black_ms: number | null;
  turn_started_at: string | null;
  draw_offer: ColorCode | null;
  takeback_request: ColorCode | null;
  rematch_id: string | null;
}

export type Seat = ColorCode | "spectator";

const TOKENS_KEY = "hive.online.tokens";

function tokens(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(TOKENS_KEY) ?? "{}");
  } catch {
    return {};
  }
}

/** This browser's secret for a game, created on first use. */
export function tokenFor(id: string, create = true): string | null {
  const all = tokens();
  if (!all[id] && create) {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    all[id] = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    try {
      localStorage.setItem(TOKENS_KEY, JSON.stringify(all));
    } catch {}
  }
  return all[id] ?? null;
}

function storeToken(id: string, token: string) {
  const all = tokens();
  all[id] = token;
  try {
    localStorage.setItem(TOKENS_KEY, JSON.stringify(all));
  } catch {}
}

function newToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await sb().rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export async function createOnlineGame(rules: Rules, color: ColorCode | "random", timeControl: string) {
  const c = color === "random" ? (Math.random() < 0.5 ? "w" : "b") : color;
  const tc = TIME_CONTROLS.find((t) => t.id === timeControl) ?? TIME_CONTROLS[0];
  const token = newToken();
  const id = await rpc<string>("create_game", {
    p_game_type: gameTypeString(rules),
    p_tournament: rules.tournament,
    p_color: c,
    p_token: token,
    p_base_ms: tc.baseMs,
    p_increment_ms: tc.incMs,
  });
  storeToken(id, token);
  return { id, color: c };
}

export async function fetchGame(id: string): Promise<OnlineGame | null> {
  const { data, error } = await sb().from("games").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as OnlineGame | null;
}

export function joinGame(id: string) {
  return rpc<Seat>("join_game", { p_id: id, p_token: tokenFor(id) });
}

export function playMove(id: string, ply: number, move: string, result?: string | null, reason?: string) {
  return rpc<number>("play_move", { p_id: id, p_token: tokenFor(id), p_ply: ply, p_move: move, p_result: result ?? null, p_reason: reason ?? null });
}

export const resign = (id: string) => rpc<void>("resign_game", { p_id: id, p_token: tokenFor(id) });
export const offerDraw = (id: string) => rpc<void>("offer_draw", { p_id: id, p_token: tokenFor(id) });
export const declineDraw = (id: string) => rpc<void>("decline_draw", { p_id: id, p_token: tokenFor(id) });
export const requestTakeback = (id: string) => rpc<void>("request_takeback", { p_id: id, p_token: tokenFor(id) });
export const answerTakeback = (id: string, accept: boolean) => rpc<void>("answer_takeback", { p_id: id, p_token: tokenFor(id), p_accept: accept });
export const claimTimeout = (id: string) => rpc<boolean>("claim_timeout", { p_id: id });

export async function createRematch(id: string) {
  const token = newToken();
  const rid = await rpc<string>("create_rematch", { p_id: id, p_token: tokenFor(id), p_new_token: token });
  // If the opponent created it first, our new token isn't registered; join_game will claim the free seat.
  if (!tokens()[rid]) storeToken(rid, token);
  return rid;
}

/** Milliseconds to add to Date.now() to approximate the server clock. */
export async function serverOffset(): Promise<number> {
  const t0 = Date.now();
  const now = await rpc<string>("server_now", {});
  const t1 = Date.now();
  return new Date(now).getTime() - (t0 + t1) / 2;
}

/** Subscribes to changes of one game. Returns an unsubscribe function. */
export function subscribeGame(id: string, onChange: (g: OnlineGame) => void, onStatus?: (connected: boolean) => void) {
  const channel: RealtimeChannel = sb()
    .channel(`game-${id}`)
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "games", filter: `id=eq.${id}` }, (payload) => onChange(payload.new as OnlineGame))
    .subscribe((status) => onStatus?.(status === "SUBSCRIBED"));
  return () => {
    sb().removeChannel(channel);
  };
}

export function rulesFromRow(g: OnlineGame): Rules {
  const ext = g.game_type.split("+")[1] ?? "";
  return { mosquito: ext.includes("M"), ladybug: ext.includes("L"), pillbug: ext.includes("P"), tournament: g.tournament };
}
