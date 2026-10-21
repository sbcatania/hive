import { BugGlyph } from "./BugGlyph";
import { roundedHexPath, TILE } from "@/lib/themes";
import { BUG_NAMES, type ColorCode, type HandView } from "@/lib/engine-types";

interface Props {
  color: ColorCode;
  hand: HandView[];
  selected: string | null;
  /** Names of hand pieces that can be placed right now (by the local player). */
  placeable: Set<string>;
  onSelect?: (name: string) => void;
}

/** The tray of unplayed pieces for one player. Any piece can be clicked to inspect it. */
export function HandPanel({ color, hand, selected, placeable, onSelect }: Props) {
  const t = TILE[color];
  const left = hand.reduce((n, h) => n + h.count, 0);
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5" aria-label={`${color === "w" ? "White" : "Black"} pieces in hand`}>
      {hand.map((h) => {
        const name = h.next;
        const can = !!name && placeable.has(name);
        const sel = !!name && name === selected;
        return (
          <button
            key={h.bug}
            disabled={!name || !onSelect}
            onClick={() => name && onSelect?.(name)}
            title={`${BUG_NAMES[h.bug]} × ${h.count}${can ? " (click to place)" : ""}`}
            className={`relative h-11 w-10 shrink-0 transition-transform sm:h-12 sm:w-11 ${h.count === 0 ? "opacity-20" : ""} ${name && onSelect ? "cursor-pointer hover:-translate-y-0.5" : "cursor-default"} ${sel ? "-translate-y-1" : ""}`}
          >
            <svg viewBox="-50 -50 100 100" className="h-full w-full overflow-visible">
              <path d={roundedHexPath(0, 4, 45, 0.2)} fill={t.side} />
              <path
                d={roundedHexPath(0, 0, 45, 0.2)}
                fill={t.fill}
                stroke={sel ? "var(--sky)" : can ? "var(--leaf)" : color === "b" ? "var(--tile-black-rim)" : t.edge}
                strokeWidth={sel ? 9 : can ? 6 : 3}
              />
              <g transform="translate(-27 -27) scale(0.54)">
                <BugGlyph bug={h.bug} ink={t.ink} />
              </g>
            </svg>
            {h.count > 1 && (
              <span className="absolute -top-1 -right-1 rounded-full bg-ink px-1.5 text-[10px] leading-4 font-bold text-paper">{h.count}</span>
            )}
          </button>
        );
      })}
      {left === 0 && <span className="text-xs text-muted italic">All pieces in play</span>}
    </div>
  );
}
