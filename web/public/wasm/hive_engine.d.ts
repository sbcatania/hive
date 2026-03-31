/* tslint:disable */
/* eslint-disable */

/**
 * Run the AI to pick a move. Returns the chosen Move as JSON.
 *
 * `ai_config_json` specifies the engine (minimax/mcts) and difficulty.
 */
export function ai_pick_move(state_json: string, ai_config_json: string): string;

/**
 * Apply a move to the game state.
 * Returns the updated game state as JSON.
 */
export function apply_move(state_json: string, move_json: string): string;

/**
 * Create a new game with the given rule configuration (JSON string).
 * Returns the initial game state as JSON.
 */
export function create_game(rules_json: string): string;

/**
 * Get all legal moves for the current player.
 * Returns a JSON array of Move objects.
 */
export function get_legal_moves(state_json: string): string;

/**
 * Get all available game presets as JSON.
 */
export function get_presets(): string;

/**
 * Redo a previously undone move. Returns updated state as JSON.
 */
export function redo_move(state_json: string): string;

/**
 * Undo the last move. Returns updated state as JSON.
 */
export function undo_move(state_json: string): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly ai_pick_move: (a: number, b: number, c: number, d: number) => [number, number, number, number];
    readonly apply_move: (a: number, b: number, c: number, d: number) => [number, number, number, number];
    readonly create_game: (a: number, b: number) => [number, number, number, number];
    readonly get_legal_moves: (a: number, b: number) => [number, number, number, number];
    readonly get_presets: () => [number, number, number, number];
    readonly redo_move: (a: number, b: number) => [number, number, number, number];
    readonly undo_move: (a: number, b: number) => [number, number, number, number];
    readonly __wbindgen_exn_store: (a: number) => void;
    readonly __externref_table_alloc: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
