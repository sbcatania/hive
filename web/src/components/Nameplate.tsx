import { MiniTile, sketchHexPath } from "./PieceTile";
import type { BugLetter, ColorCode } from "@/lib/engine-types";

/** Six pencilled hexes showing how surrounded a player's Queen is. */
export function QueenDanger({ count, need }: { count: number; need: number }) {
  const danger = count >= need - 1 && count > 0;
  return (
    <div className="flex items-center gap-1" title={`Queen surrounded on ${count} of ${need} sides needed to capture`}>
      <svg viewBox="0 0 76 14" className="h-3.5 w-[76px]" aria-hidden>
        {Array.from({ length: 6 }, (_, i) => {
          const filled = i < count;
          const out = i >= need;
          return (
            <path
              key={i}
              d={sketchHexPath(7 + i * 12.2, 7, 5.6, i * 3 + 1, 0.08)}
              fill={filled ? (danger ? "var(--threat)" : "var(--accent)") : "transparent"}
              fillOpacity={filled ? 0.85 : 0}
              stroke={out ? "var(--line)" : "var(--ink-soft)"}
              strokeDasharray={out ? "2 2" : undefined}
              strokeWidth={1.2}
            />
          );
        })}
      </svg>
      <span className={`text-[11px] tabular-nums ${danger ? "font-bold text-threat" : "text-muted"}`}>
        {count}/{need}
      </span>
    </div>
  );
}

/** A player's tile: their persona bug, or their initial pencilled on a blank tile. */
export function Avatar({ bug, color, initial, size = 40 }: { bug?: BugLetter; color: ColorCode; initial?: string; size?: number }) {
  if (bug) return <MiniTile bug={bug} color={color} size={size} seed={initial?.charCodeAt(0) ?? 3} />;
  const white = color === "w";
  return (
    <svg viewBox="-50 -50 100 100" width={size} height={size} className="shrink-0 overflow-visible" aria-hidden>
      <path d={sketchHexPath(4, 5, 43, 9, 0.05)} fill="#3a2a17" opacity={0.13} />
      <path d={sketchHexPath(0, 0, 44, 4)} fill={white ? "#fbf5e6" : "#2d2b29"} stroke={white ? "#2b2218" : "#efe6d2"} strokeWidth={3} strokeLinejoin="round" />
      <text textAnchor="middle" dy="0.34em" fontSize="46" fill={white ? "#2b2218" : "#efe6d2"} fontFamily="var(--font-hand)">
        {initial}
      </text>
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
      className={`relative flex min-w-0 items-center gap-2.5 border-[1.6px] px-2.5 py-1.5 transition sm:gap-3 sm:px-3 sm:py-2 ${active ? "border-ink-soft bg-[color-mix(in_oklab,var(--accent)_14%,var(--card))]" : "border-line bg-card/60"}`}
      style={{ borderRadius: "14px 5px 16px 6px / 6px 16px 5px 14px" }}
    >
      <Avatar bug={bug} color={color} initial={typeof name === "string" ? name.slice(0, 1).toUpperCase() : "?"} size={36} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate font-display text-[1.05rem] font-semibold">{name}</span>
          {active && <span className={`font-hand text-lg leading-none text-accent-strong ${thinking ? "pulse-ink" : ""}`}>{thinking ? "thinking…" : "to move"}</span>}
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
