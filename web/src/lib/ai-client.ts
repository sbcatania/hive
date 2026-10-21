import type { AiResult, Level } from "./engine-types";

type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void };

/**
 * Promise wrapper around the AI worker. Each client owns one worker, so a
 * game's CPU opponent and its analysis don't block each other's caches.
 */
export class AiClient {
  private worker: Worker;
  private nextId = 1;
  private pending = new Map<number, Pending>();

  constructor() {
    this.worker = new Worker(new URL("../workers/ai.worker.ts", import.meta.url), { type: "module" });
    this.worker.onmessage = (ev: MessageEvent<{ id: number; ok: boolean; result?: unknown; error?: string }>) => {
      const p = this.pending.get(ev.data.id);
      if (!p) return;
      this.pending.delete(ev.data.id);
      if (ev.data.ok) p.resolve(ev.data.result);
      else p.reject(new Error(ev.data.error));
    };
  }

  private call<T>(msg: Record<string, unknown>): Promise<T> {
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
      this.worker.postMessage({ ...msg, id });
    });
  }

  choose(gameString: string, tournament: boolean, level: Level, timeMs = 0) {
    return this.call<AiResult>({ type: "choose", gameString, tournament, level, timeMs });
  }

  analyze(gameString: string, tournament: boolean, timeMs = 1200) {
    return this.call<AiResult>({ type: "analyze", gameString, tournament, timeMs });
  }

  info() {
    return this.call<{ network: string | null }>({ type: "info" });
  }

  terminate() {
    this.worker.terminate();
    for (const p of this.pending.values()) p.reject(new Error("cancelled"));
    this.pending.clear();
  }
}
