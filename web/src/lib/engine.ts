// Loads the WebAssembly rules engine on the main thread (move generation and
// game state). The AI runs separately in a Web Worker (see ai-client.ts).
import init, { HiveGame } from "@/wasm/hive_engine";
import { normalizeRules, type PreviewView, type Rules, type StateView } from "./engine-types";

let ready: Promise<unknown> | null = null;

export function loadEngine() {
  if (!ready) ready = init({ module_or_path: "/wasm/hive_engine_bg.wasm" });
  return ready;
}

/** Thin wrapper over the WASM game; call free() when done. */
export class Engine {
  private game: HiveGame;
  readonly rules: Rules;

  private constructor(game: HiveGame, rules: Rules) {
    this.game = game;
    this.rules = rules;
  }

  static create(rules: Partial<Rules>) {
    const r = normalizeRules(rules);
    return new Engine(HiveGame.withRules(r), r);
  }

  /** Parses a UHP game string (official rules apart from the expansions in it). */
  static fromGameString(s: string, tournament: boolean) {
    const g = HiveGame.fromGameString(s, tournament);
    const st = g.state() as StateView;
    return new Engine(g, normalizeRules(st.rules));
  }

  state(): StateView {
    return this.game.state() as StateView;
  }

  preview(piece: string): PreviewView {
    return this.game.preview(piece) as PreviewView;
  }

  /** Plays a UHP move string; throws with a readable message if illegal. */
  play(move: string): string {
    return this.game.play(move);
  }

  undo() {
    return this.game.undo();
  }

  setResult(result: "WhiteWins" | "BlackWins" | "Draw") {
    this.game.setResult(result);
  }

  gameString() {
    return this.game.gameString();
  }

  free() {
    this.game.free();
  }
}

/** Replays a list of move strings from scratch. */
export function engineFromMoves(rules: Partial<Rules>, moves: string[]) {
  const e = Engine.create(rules);
  for (const m of moves) e.play(m);
  return e;
}

/** Runs `fn` on a temporary engine at the given position and frees it. */
export function withEngine<T>(rules: Partial<Rules>, moves: string[], fn: (e: Engine) => T): T {
  const e = engineFromMoves(rules, moves);
  try {
    return fn(e);
  } finally {
    e.free();
  }
}

export function errorMessage(e: unknown): string {
  const raw = e instanceof Error ? e.message : e && typeof e === "object" && "message" in e ? String((e as { message: unknown }).message) : String(e);
  if (/Failed to fetch|NetworkError|Load failed/i.test(raw)) return "Can't reach the game server. Check your connection and try again.";
  return raw;
}
