import type { AiResult } from "@/lib/engine-types";

/** White's estimated winning chances: a pencilled bar, White's share hatched in from the left. */
export function EvalBar({ result, loading }: { result: AiResult | null; loading?: boolean }) {
  const p = result ? result.whiteWinProb : 0.5;
  const pct = Math.round(p * 100);
  const forced = result && Math.abs(result.scoreWhite) >= 999_000;
  const label = !result ? "—" : forced ? (result.scoreWhite > 0 ? "White wins by force" : "Black wins by force") : `White ${pct}%, Black ${100 - pct}%`;
  const w = 4 + p * 192;
  return (
    <div className="card p-3">
      <div className="mb-1 flex justify-between text-xs">
        <span className="eval-label label mb-0">Evaluation{loading ? " (thinking)" : ""}</span>
        <span className="whitespace-nowrap text-ink-soft">{label}</span>
      </div>
      <svg viewBox="0 0 200 16" className="h-4 w-full" preserveAspectRatio="none" aria-hidden>
        <defs>
          <pattern id="eval-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(40)">
            <line x1="0" y1="0" x2="0" y2="5" stroke="var(--ink)" strokeWidth="2.2" />
          </pattern>
        </defs>
        <path d="M3 3 Q100 1.5 197 3 L197 13 Q100 14.5 3 13Z" fill="var(--chalk)" fillOpacity={0.5} />
        <rect x={3} y={3} width={Math.max(0, 200 - 6 - (w - 4))} height={10} transform={`translate(${w - 1} 0)`} fill="url(#eval-hatch)" opacity={0.85} className="transition-all duration-500" />
        <path d="M3 3 Q100 1.5 197 3 L197 13 Q100 14.5 3 13Z" fill="none" stroke="var(--ink-soft)" strokeWidth={1.5} style={{ filter: "url(#pencil)" }} />
      </svg>
    </div>
  );
}
