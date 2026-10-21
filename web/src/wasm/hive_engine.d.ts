/* tslint:disable */
/* eslint-disable */

export class HiveAi {
    free(): void;
    [Symbol.dispose](): void;
    analyze(rules: any, moves: string, time_ms: number): any;
    /**
     * Chooses a move for the side to move. `moves` is a ';'-separated list of
     * UHP move strings. `level`: easy | medium | hard | expert.
     */
    choose(rules: any, moves: string, level: string, time_ms: number): any;
    hasNetwork(): boolean;
    loadNetwork(bytes: Uint8Array): string;
    constructor(seed: number);
}

export class HiveGame {
    free(): void;
    [Symbol.dispose](): void;
    static fromGameString(s: string, tournament: boolean): HiveGame;
    gameString(): string;
    constructor(mosquito: boolean, ladybug: boolean, pillbug: boolean, tournament: boolean);
    /**
     * Plays a UHP move string. Returns the normalised move string.
     */
    play(move_str: string): string;
    ply(): number;
    /**
     * Where a piece could move (legal now, or next turn for the other side),
     * plus an explanation when it can't move at all.
     */
    preview(piece: string): any;
    /**
     * Ends the game by resignation, timeout or agreement: "WhiteWins", "BlackWins" or "Draw".
     */
    setResult(result: string): void;
    state(): any;
    undo(): boolean;
    /**
     * Creates a game from a full rules object (see `Rules` in engine-types.ts).
     */
    static withRules(rules: any): HiveGame;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_hiveai_free: (a: number, b: number) => void;
    readonly __wbg_hivegame_free: (a: number, b: number) => void;
    readonly hiveai_analyze: (a: number, b: any, c: number, d: number, e: number) => [number, number, number];
    readonly hiveai_choose: (a: number, b: any, c: number, d: number, e: number, f: number, g: number) => [number, number, number];
    readonly hiveai_hasNetwork: (a: number) => number;
    readonly hiveai_loadNetwork: (a: number, b: number, c: number) => [number, number, number, number];
    readonly hiveai_new: (a: number) => number;
    readonly hivegame_fromGameString: (a: number, b: number, c: number) => [number, number, number];
    readonly hivegame_gameString: (a: number) => [number, number];
    readonly hivegame_new: (a: number, b: number, c: number, d: number) => number;
    readonly hivegame_play: (a: number, b: number, c: number) => [number, number, number, number];
    readonly hivegame_ply: (a: number) => number;
    readonly hivegame_preview: (a: number, b: number, c: number) => [number, number, number];
    readonly hivegame_setResult: (a: number, b: number, c: number) => void;
    readonly hivegame_state: (a: number) => any;
    readonly hivegame_undo: (a: number) => number;
    readonly hivegame_withRules: (a: any) => [number, number, number];
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_exn_store: (a: number) => void;
    readonly __externref_table_alloc: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
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
