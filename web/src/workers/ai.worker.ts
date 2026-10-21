/// <reference lib="webworker" />
// Runs the CPU opponent off the main thread so the board stays responsive.
import init, { HiveAi } from "@/wasm/hive_engine";

type Request =
  | { id: number; type: "choose"; rules: unknown; moves: string[]; level: string; timeMs: number }
  | { id: number; type: "analyze"; rules: unknown; moves: string[]; timeMs: number }
  | { id: number; type: "info" };

let ai: HiveAi | null = null;
let networkName: string | null = null;

const ready = (async () => {
  await init({ module_or_path: "/wasm/hive_engine_bg.wasm" });
  ai = new HiveAi(Math.floor(Math.random() * 2 ** 31) + 1);
  try {
    const manifest = await fetch("/models/manifest.json", { cache: "no-cache" });
    if (manifest.ok) {
      const { file, name } = (await manifest.json()) as { file: string | null; name?: string };
      const res = file ? await fetch(`/models/${file}`) : null;
      if (res?.ok) {
        const bytes = new Uint8Array(await res.arrayBuffer());
        networkName = ai.loadNetwork(bytes) || name || file;
      }
    }
  } catch (e) {
    console.warn("No neural network loaded:", e);
  }
})();

self.onmessage = async (ev: MessageEvent<Request>) => {
  const req = ev.data;
  try {
    await ready;
    if (!ai) throw new Error("AI failed to load");
    let result: unknown;
    if (req.type === "choose") {
      result = ai.choose(req.rules, req.moves.join(";"), req.level, req.timeMs);
    } else if (req.type === "analyze") {
      result = ai.analyze(req.rules, req.moves.join(";"), req.timeMs);
    } else {
      result = { network: networkName };
    }
    self.postMessage({ id: req.id, ok: true, result });
  } catch (e) {
    self.postMessage({ id: req.id, ok: false, error: e instanceof Error ? e.message : String(e) });
  }
};
