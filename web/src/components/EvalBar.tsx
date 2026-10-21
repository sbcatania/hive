import type { AiResult } from "@/lib/engine-types";

/** White's estimated winning chances, as a bar from Black (right) to White (left). */
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
    <div className="card !p-3">
      <div className="mb-1.5 flex justify-between text-xs">
        <span className="label mb-0">Evaluation {loading ? "· thinking" : ""}</span>
        <span className="text-ink-soft">{label}</span>
      </div>
      <div className="flex h-3 overflow-hidden rounded-full border border-line-strong bg-[#2b2b30]">
        <div className="bg-[#f6f0e2] transition-all duration-500" style={{ width: `${p * 100}%` }} />
      </div>
    </div>
  );
}
