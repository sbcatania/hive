import { PieceTile, sketchHexPath } from "./PieceTile";
import { BUG_NAMES, type ColorCode, type HandView } from "@/lib/engine-types";

interface Props {
  color: ColorCode;
  hand: HandView[];
  selected: string | null;
  /** Names of hand pieces that can be placed right now (by the local player). */
  placeable: Set<string>;
  onSelect?: (name: string) => void;
  /** Smaller tiles on phones (the opponent's tray). */
  small?: boolean;
  className?: string;
}

/** The tray of unplayed pieces for one player. Any piece can be tapped to inspect it. */
export function HandPanel({ color, hand, selected, placeable, onSelect, small, className }: Props) {
  const left = hand.reduce((n, h) => n + h.count, 0);
  return (
    <div className={`-mx-1 flex items-center gap-0.5 overflow-x-auto overscroll-x-contain px-1 pt-1.5 pb-0.5 [scrollbar-width:none] ${className ?? ""}`} aria-label={`${color === "w" ? "White" : "Black"} pieces in hand`}>
      {left > 0 && hand.map((h, i) => {
        const name = h.next;
        const can = !!name && placeable.has(name);
        const sel = !!name && name === selected;
        return (
          <button
            key={h.bug}
            disabled={!name || !onSelect}
            onClick={() => name && onSelect?.(name)}
            aria-label={`${BUG_NAMES[h.bug]}, ${h.count} left${can ? ", tap to place" : ""}`}
            aria-pressed={sel}
            className={`relative grid shrink-0 place-items-center transition-transform ${small ? "h-9 w-9 lg:h-12 lg:w-12" : "h-11 w-11 lg:h-12 lg:w-12"} ${h.count === 0 ? "opacity-20" : ""} ${name && onSelect ? "cursor-pointer active:scale-95" : "cursor-default"} ${sel ? "-translate-y-1.5" : ""}`}
          >
            <svg viewBox="-50 -50 100 100" className={`overflow-visible ${small ? "h-8 w-8 lg:h-11 lg:w-11" : "h-10 w-10 lg:h-11 lg:w-11"}`}>
              <PieceTile bug={h.bug} color={color} x={0} y={0} size={42} seed={i * 7 + (color === "w" ? 1 : 2)} />
              {(sel || can) && (
                <path
                  d={sketchHexPath(0, 0, 49, i * 7 + 5, 0.05)}
                  fill="none"
                  stroke={sel ? "var(--select)" : "var(--move)"}
                  strokeWidth={sel ? 4.5 : 2.6}
                  strokeDasharray={sel ? undefined : "1 6"}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
            </svg>
            {h.count > 1 && (
              <span className={`absolute -top-0.5 -right-0.5 font-hand leading-none font-semibold text-ink-soft ${small ? "text-sm lg:text-lg" : "text-base lg:text-lg"}`} aria-hidden>
                ×{h.count}
              </span>
            )}
          </button>
        );
      })}
      {left === 0 && <span className="hand-note px-1 !text-base whitespace-nowrap">all pieces in play</span>}
    </div>
  );
}
