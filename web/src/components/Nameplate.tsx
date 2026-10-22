import { MiniTile, sketchHexPath } from "./PieceTile";
import type { BugLetter, ColorCode } from "@/lib/engine-types";

/** Six pencilled hexes showing how surrounded a player's Queen is. */
export function QueenDanger({ count, need, compact }: { count: number; need: number; compact?: boolean }) {
  const danger = count >= need - 1 && count > 0;
  return (
    <div className="flex items-center gap-1" role="img" aria-label={`Queen surrounded on ${count} of ${need} sides needed to capture`}>
      <svg viewBox="0 0 76 14" className={compact ? "h-2.5 w-[54px]" : "h-3.5 w-[76px]"} aria-hidden>
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
      <path d={sketchHexPath(0, 0, 44, 4)} fill={white ? "var(--tile-white)" : "var(--tile-black)"} stroke={white ? "var(--tile-white-ink)" : "var(--tile-black-rim)"} strokeWidth={3} strokeLinejoin="round" />
      <text textAnchor="middle" dy="0.34em" fontSize="46" fill={white ? "var(--tile-white-ink)" : "var(--tile-black-ink)"} fontFamily="var(--font-hand)">
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

/** A player's name, turn marker and Queen danger. On phones it shrinks to a narrow
 * block that sits beside the player's pieces (see GameView): the name, then the Queen
 * danger on a fixed-height second line, with the turn shown by the honey fill and a
 * small hex beside the name. */
export function Nameplate({ color, name, sub, bug, active, thinking, queenCount, need, clock }: Props) {
  return (
    <div className={`pencil flex min-w-0 items-center gap-2 px-2.5 py-1.5 lg:gap-3 lg:px-3 lg:py-2 ${active ? "pencil-honey pencil-strong" : "pencil-clear"}`}>
      <span className="hidden lg:block">
        <Avatar bug={bug} color={color} initial={typeof name === "string" ? name.slice(0, 1).toUpperCase() : "?"} size={36} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 lg:gap-2">
          <span className="truncate font-display text-[0.92rem] leading-tight font-semibold lg:text-[1.05rem]">{name}</span>
          {active && <TurnMark />}
          {active && <span className={`hidden font-hand text-lg leading-none text-ink-soft lg:inline ${thinking ? "pulse-ink" : ""}`}>{thinking ? "thinking…" : "to move"}</span>}
        </div>
        <div className="mt-0.5 flex h-4 items-center gap-x-3 text-xs text-muted lg:h-auto lg:flex-wrap lg:gap-y-0.5">
          {sub && <span className="hidden truncate lg:inline">{sub}</span>}
          {thinking ? (
            <span className="pulse-ink font-hand text-base leading-none text-ink-soft lg:hidden">thinking…</span>
          ) : (
            <span className="lg:hidden">
              <QueenDanger count={queenCount} need={need} compact />
            </span>
          )}
          <span className="hidden lg:inline">
            <QueenDanger count={queenCount} need={need} />
          </span>
        </div>
      </div>
      {clock && <span className="hidden lg:block">{clock}</span>}
    </div>
  );
}

/** The small honey hex that marks whose turn it is (the same mark as elsewhere). */
function TurnMark() {
  return <span aria-label="to move" className="anim-boop inline-block h-[9px] w-[8px] shrink-0 bg-accent-strong [clip-path:polygon(50%_0,100%_25%,100%_75%,50%_100%,0_75%,0_25%)] lg:hidden" />;
}
