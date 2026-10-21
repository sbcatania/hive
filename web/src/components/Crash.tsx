"use client";

import { useEffect } from "react";

const CHUNK = /Loading chunk|ChunkLoadError|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i;

/** Shown when a screen crashes. After an app update, an open page can ask for code
 * that no longer exists; that case reloads once by itself. Anything else shows the
 * actual error, so it can be reported. */
export function Crash({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    try {
      localStorage.setItem("hive.last-error", JSON.stringify({ at: new Date().toISOString(), path: location.pathname + location.search, message: String(error?.message ?? error), stack: String(error?.stack ?? "").slice(0, 1500) }));
      if (CHUNK.test(String(error?.message)) && !sessionStorage.getItem("hive.chunk-reload")) {
        sessionStorage.setItem("hive.chunk-reload", "1");
        location.reload();
      }
    } catch {}
  }, [error]);
  return (
    <div className="mx-auto grid min-h-[60dvh] max-w-md place-items-center px-6 text-center">
      <div>
        <h1 className="font-display text-3xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-ink-soft">This screen hit an error. Your games are saved.</p>
        <div className="mt-5 flex justify-center gap-2">
          <button className="btn" onClick={() => location.reload()}>
            Reload
          </button>
          <button className="btn-secondary" onClick={() => (location.href = "/")}>
            Home
          </button>
        </div>
        <p className="mt-6 font-mono text-xs break-words text-muted">{String(error?.message ?? error).slice(0, 300)}</p>
        <button className="mt-2 text-xs text-muted underline" onClick={reset}>
          Try again without reloading
        </button>
      </div>
    </div>
  );
}
