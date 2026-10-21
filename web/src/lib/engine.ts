// Loads the WebAssembly rules engine on the main thread (move generation and
// game state). The AI runs separately in a Web Worker (see ai-client.ts).
import init, { HiveGame } from "@/wasm/hive_engine";
import type { Rules, StateView } from "./engine-types";

let ready: Promise<unknown> | null = null;

export function loadEngine() {
  if (!ready) ready = init({ module_or_path: "/wasm/hive_engine_bg.wasm" });
  return ready;
}

/** Immutable-style wrapper: every mutation returns a fresh state snapshot. */
export class Engine {
  private game: HiveGame;

  private constructor(game: HiveGame, public tournament: boolean) {
    this.game = game;
  }

  static create(rules: Rules) {
    return new Engine(new HiveGame(rules.mosquito, rules.ladybug, rules.pillbug, rules.tournament), rules.tournament);
  }

  static fromGameString(s: string, tournament: boolean) {
    return new Engine(HiveGame.fromGameString(s, tournament), tournament);
  }

  state(): StateView {
    return this.game.state() as StateView;
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
export function engineFromMoves(rules: Rules, moves: string[]) {
  const e = Engine.create(rules);
  for (const m of moves) e.play(m);
  return e;
}

export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}
