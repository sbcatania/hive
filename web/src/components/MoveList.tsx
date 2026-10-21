"use client";

import { useEffect, useRef } from "react";

/** Move history as a two-column journal. Optionally clickable (replays). */
export function MoveList({ history, current, onSelect }: { history: string[]; current?: number; onSelect?: (ply: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (current === undefined) ref.current?.scrollTo({ top: ref.current.scrollHeight });
  }, [history.length, current]);
  const rows: [string, string | undefined][] = [];
  for (let i = 0; i < history.length; i += 2) rows.push([history[i], history[i + 1]]);
  const cell = (m: string | undefined, ply: number) => {
    if (!m) return <td className="px-2 py-0.5" />;
    const active = current === ply;
    return (
      <td className="px-1 py-0.5">
        {onSelect ? (
          <button onClick={() => onSelect(ply)} className={`w-full rounded px-1 text-left ${active ? "bg-accent text-accent-ink" : "hover:bg-card-2"}`}>
            {m}
          </button>
        ) : (
          <span className="px-1">{m}</span>
        )}
      </td>
    );
  };
  return (
    <div ref={ref} className="max-h-64 overflow-y-auto sk border border-line bg-card font-mono text-xs">
      {rows.length === 0 ? (
        <div className="p-3 font-sans text-muted italic">No moves yet. The first piece is waiting to be played.</div>
      ) : (
        <table className="w-full">
          <tbody>
            {rows.map(([w, b], i) => (
              <tr key={i} className="odd:bg-paper-2/60">
                <td className="w-8 px-2 py-0.5 text-right text-muted">{i + 1}.</td>
                {cell(w, i * 2 + 1)}
                {cell(b, i * 2 + 2)}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
