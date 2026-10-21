/* tslint:disable */
/* eslint-disable */
export const memory: WebAssembly.Memory;
export const __wbg_hiveai_free: (a: number, b: number) => void;
export const __wbg_hivegame_free: (a: number, b: number) => void;
export const hiveai_analyze: (a: number, b: any, c: number, d: number, e: number) => [number, number, number];
export const hiveai_choose: (a: number, b: any, c: number, d: number, e: number, f: number, g: number) => [number, number, number];
export const hiveai_hasNetwork: (a: number) => number;
export const hiveai_loadNetwork: (a: number, b: number, c: number) => [number, number, number, number];
export const hiveai_new: (a: number) => number;
export const hivegame_fromGameString: (a: number, b: number, c: number) => [number, number, number];
export const hivegame_gameString: (a: number) => [number, number];
export const hivegame_new: (a: number, b: number, c: number, d: number) => number;
export const hivegame_play: (a: number, b: number, c: number) => [number, number, number, number];
export const hivegame_ply: (a: number) => number;
export const hivegame_preview: (a: number, b: number, c: number) => [number, number, number];
export const hivegame_setResult: (a: number, b: number, c: number) => void;
export const hivegame_state: (a: number) => any;
export const hivegame_undo: (a: number) => number;
export const hivegame_withRules: (a: any) => [number, number, number];
export const __wbindgen_malloc: (a: number, b: number) => number;
export const __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
export const __wbindgen_exn_store: (a: number) => void;
export const __externref_table_alloc: () => number;
export const __wbindgen_externrefs: WebAssembly.Table;
export const __externref_table_dealloc: (a: number) => void;
export const __wbindgen_free: (a: number, b: number, c: number) => void;
export const __wbindgen_start: () => void;
