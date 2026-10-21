import { PieceTile, sketchHexPath } from "./PieceTile";
import { BUG_NAMES, type ColorCode, type HandView } from "@/lib/engine-types";

interface Props {
  color: ColorCode;
  hand: HandView[];
  selected: string | null;
  /** Names of hand pieces that can be placed right now (by the local player). */
  placeable: Set<string>;
  onSelect?: (name: string) => void;
}

/** The tray of unplayed pieces for one player. Any piece can be tapped to inspect it. */
export function HandPanel({ color, hand, selected, placeable, onSelect }: Props) {
  const left = hand.reduce((n, h) => n + h.count, 0);
  return (
    <div className="-mx-1 flex items-center gap-0.5 overflow-x-auto px-1 pt-1.5 pb-0.5 [scrollbar-width:none]" aria-label={`${color === "w" ? "White" : "Black"} pieces in hand`}>
      {hand.map((h, i) => {
        const name = h.next;
        const can = !!name && placeable.has(name);
        const sel = !!name && name === selected;
        return (
          <button
            key={h.bug}
            disabled={!name || !onSelect}
            onClick={() => name && onSelect?.(name)}
            title={`${BUG_NAMES[h.bug]} × ${h.count}${can ? " (tap to place)" : ""}`}
            aria-label={`${BUG_NAMES[h.bug]}, ${h.count} left`}
            aria-pressed={sel}
            className={`relative grid h-12 w-12 shrink-0 place-items-center transition-transform ${h.count === 0 ? "opacity-20" : ""} ${name && onSelect ? "cursor-pointer active:scale-95" : "cursor-default"} ${sel ? "-translate-y-1.5" : ""}`}
          >
            <svg viewBox="-50 -50 100 100" className="h-11 w-11 overflow-visible">
              {sel && <ellipse cx={3} cy={40} rx={34} ry={9} fill="var(--ink)" opacity={0.16} />}
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
              <span className="absolute -top-0.5 right-0 font-hand text-lg leading-none font-semibold text-ink-soft" aria-hidden>
                ×{h.count}
              </span>
            )}
          </button>
        );
      })}
      {left === 0 && <span className="hand-note px-1 !text-base">all pieces in play</span>}
    </div>
  );
}
