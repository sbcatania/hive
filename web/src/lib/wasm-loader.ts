/// Loads the Hive WASM engine module.
/// The WASM files are served from /wasm/ in the public directory.

let wasmModule: typeof import("../../public/wasm/hive_engine") | null = null;
let initPromise: Promise<typeof import("../../public/wasm/hive_engine")> | null = null;

export async function loadEngine() {
  if (wasmModule) return wasmModule;

  if (!initPromise) {
    initPromise = (async () => {
      const wasm = await import("../../public/wasm/hive_engine");
      await wasm.default();
      wasmModule = wasm;
      return wasm;
    })();
  }

  return initPromise;
}

export type WasmEngine = Awaited<ReturnType<typeof loadEngine>>;
