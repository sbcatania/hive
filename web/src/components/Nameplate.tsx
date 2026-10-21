import { BugGlyph } from "./BugGlyph";
import { roundedHexPath, TILE } from "@/lib/themes";
import type { BugLetter, ColorCode } from "@/lib/engine-types";

/** Six pips showing how surrounded a player's Queen is. */
export function QueenDanger({ count, need }: { count: number; need: number }) {
  const danger = count >= need - 1;
  return (
    <div className="flex items-center gap-1" title={`Queen surrounded on ${count} of ${need} sides needed to capture`}>
      <svg viewBox="0 0 74 14" className="h-3.5 w-[74px]" aria-hidden>
        {Array.from({ length: 6 }, (_, i) => {
          const filled = i < count;
          const out = i >= need;
          return (
            <path
              key={i}
              d={roundedHexPath(7 + i * 12, 7, 6, 0.2)}
              fill={filled ? (danger ? "var(--danger)" : "var(--accent)") : "transparent"}
              stroke={out ? "var(--line)" : danger && filled ? "var(--danger)" : "var(--line-strong)"}
              strokeDasharray={out ? "2 2" : undefined}
              strokeWidth={1.4}
            />
          );
        })}
      </svg>
      <span className={`text-[11px] tabular-nums ${danger ? "font-bold text-danger" : "text-muted"}`}>{count}/{need}</span>
    </div>
  );
}

export function Avatar({ bug, color, initial, size = 40 }: { bug?: BugLetter; color: ColorCode; initial?: string; size?: number }) {
  const t = TILE[color];
  return (
    <svg viewBox="-50 -50 100 100" width={size} height={size} className="shrink-0" aria-hidden>
      <path d={roundedHexPath(0, 0, 47, 0.18)} fill={t.fill} stroke={color === "b" ? "var(--tile-black-rim)" : t.edge} strokeWidth={4} />
      {bug ? (
        <g transform="translate(-30 -30) scale(0.6)">
          <BugGlyph bug={bug} ink={t.ink} />
        </g>
      ) : (
        <text textAnchor="middle" dy="0.36em" fontSize="40" fontWeight="700" fill={t.ink} fontFamily="var(--font-display)">
          {initial}
        </text>
      )}
    </svg>
  );
}

interface Props {
  color: ColorCode;
  name: React.ReactNode;
  sub?: React.ReactNode;
  bug?: BugLetter;
  active: boolean;
  thinking?: boolean;
  queenCount: number;
  need: number;
  clock?: React.ReactNode;
}

export function Nameplate({ color, name, sub, bug, active, thinking, queenCount, need, clock }: Props) {
  return (
    <div
      className={`flex min-w-0 items-center gap-3 rounded-2xl border px-3 py-2 transition ${active ? "border-accent bg-card shadow-[var(--glow)] ring-1 ring-accent/40" : "border-line bg-card/70"}`}
    >
      <Avatar bug={bug} color={color} initial={typeof name === "string" ? name.slice(0, 1).toUpperCase() : "?"} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-display text-base font-semibold">{name}</span>
          {active && (
            <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold tracking-wide text-accent-ink uppercase">
              {thinking ? "thinking" : "to move"}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted">
          {sub && <span className="truncate">{sub}</span>}
          <QueenDanger count={queenCount} need={need} />
        </div>
      </div>
      {clock}
    </div>
  );
}
