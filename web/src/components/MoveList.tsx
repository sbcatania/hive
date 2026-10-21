"use client";

import { useEffect, useRef } from "react";

/** Move history written on ruled notebook paper. Optionally clickable (replays). */
export function MoveList({ history, current, onSelect }: { history: string[]; current?: number; onSelect?: (ply: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (current === undefined) ref.current?.scrollTo({ top: ref.current.scrollHeight });
  }, [history.length, current]);
  const rows: [string, string | undefined][] = [];
  for (let i = 0; i < history.length; i += 2) rows.push([history[i], history[i + 1]]);
  const cell = (m: string | undefined, ply: number) => {
    if (!m) return <span />;
    const active = current === ply;
    return onSelect ? (
      <button onClick={() => onSelect(ply)} className={`sk px-1.5 text-left ${active ? "bg-accent/60 font-semibold text-ink" : "hover:bg-card-2"}`}>
        {m}
      </button>
    ) : (
      <span className="px-1.5">{m}</span>
    );
  };
  return (
    <div ref={ref} className="ruled max-h-64 overflow-y-auto text-[0.92rem] tabular-nums">
      {rows.length === 0 ? (
        <p className="hand-note !text-lg">No moves yet.</p>
      ) : (
        rows.map(([w, b], i) => (
          <div key={i} className="grid grid-cols-[2rem_1fr_1fr] items-center">
            <span className="font-hand text-lg text-muted">{i + 1}.</span>
            {cell(w, i * 2 + 1)}
            {cell(b, i * 2 + 2)}
          </div>
        ))
      )}
    </div>
  );
}
