"use client";

import { useEffect, useRef } from "react";

export function MoveList({ history }: { history: string[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight });
  }, [history.length]);
  const rows: [string, string | undefined][] = [];
  for (let i = 0; i < history.length; i += 2) rows.push([history[i], history[i + 1]]);
  return (
    <div ref={ref} className="max-h-56 overflow-y-auto rounded-lg border border-[var(--line)] bg-[var(--panel)] font-mono text-xs">
      {rows.length === 0 ? (
        <div className="p-2 text-neutral-500">No moves yet.</div>
      ) : (
        <table className="w-full">
          <tbody>
            {rows.map(([w, b], i) => (
              <tr key={i} className="odd:bg-black/[0.03] dark:odd:bg-white/[0.04]">
                <td className="w-8 px-2 py-0.5 text-right text-neutral-500">{i + 1}.</td>
                <td className="px-2 py-0.5">{w}</td>
                <td className="px-2 py-0.5">{b ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
