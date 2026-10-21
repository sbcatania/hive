import type { AiResult } from "@/lib/engine-types";

/** Horizontal bar: White's estimated winning chances. */
export function EvalBar({ result, loading }: { result: AiResult | null; loading?: boolean }) {
  const p = result ? result.whiteWinProb : 0.5;
  const pct = Math.round(p * 100);
  const forced = result && Math.abs(result.scoreWhite) >= 999_000;
  const label = !result
    ? "—"
    : forced
      ? result.scoreWhite > 0
        ? "White wins by force"
        : "Black wins by force"
      : `White ${pct}% · Black ${100 - pct}%`;
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-neutral-500">
        <span>Evaluation {loading ? "(thinking…)" : ""}</span>
        <span>{label}</span>
      </div>
      <div className="flex h-3 overflow-hidden rounded-full border border-[var(--line)] bg-neutral-800">
        <div className="bg-[#f7f2e6] transition-all duration-500" style={{ width: `${p * 100}%` }} />
      </div>
    </div>
  );
}
