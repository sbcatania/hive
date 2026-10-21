import { BugGlyph, hexPoints } from "./BugGlyph";
import { TILE } from "@/lib/themes";
import { BUG_NAMES, type ColorCode, type HandView } from "@/lib/engine-types";

interface Props {
  color: ColorCode;
  hand: HandView[];
  label: React.ReactNode;
  active: boolean;
  selected: string | null;
  /** Names of hand pieces that can be placed now. */
  placeable: Set<string>;
  onSelect?: (name: string) => void;
  right?: React.ReactNode;
}

export function HandPanel({ color, hand, label, active, selected, placeable, onSelect, right }: Props) {
  const t = TILE[color];
  return (
    <div className={`rounded-xl border px-3 py-2 transition-colors ${active ? "border-amber-500 bg-amber-50/80 dark:bg-amber-950/30" : "border-[var(--line)] bg-[var(--panel)]"}`}>
      <div className="mb-1 flex items-center justify-between gap-2 text-sm">
        <div className="flex items-center gap-2 font-medium">
          <span className="inline-block h-3 w-3 rounded-full border border-neutral-500" style={{ background: t.fill }} />
          {label}
        </div>
        {right}
      </div>
      <div className="flex flex-wrap gap-1">
        {hand.map((h) => {
          const name = h.next;
          const can = !!name && placeable.has(name) && !!onSelect;
          const sel = !!name && name === selected;
          return (
            <button
              key={h.bug}
              disabled={!can}
              onClick={() => name && onSelect?.(name)}
              title={`${BUG_NAMES[h.bug]} × ${h.count}`}
              className={`relative h-10 w-9 shrink-0 sm:h-12 sm:w-11 ${h.count === 0 ? "opacity-20" : ""} ${can ? "cursor-pointer hover:-translate-y-0.5" : "cursor-default"} transition-transform`}
            >
              <svg viewBox="-50 -50 100 100" className="h-full w-full overflow-visible">
                <polygon points={hexPoints(0, 0, 46)} fill={t.fill} stroke={sel ? "var(--selected)" : can ? "var(--movable)" : t.edge} strokeWidth={sel ? 8 : can ? 5 : 3} />
                <g transform="translate(-26 -26) scale(0.52)">
                  <BugGlyph bug={h.bug} ink={t.ink} />
                </g>
              </svg>
              {h.count > 1 && (
                <span className="absolute -right-1 -top-1 rounded-full bg-neutral-800 px-1.5 text-[10px] font-bold leading-4 text-white">{h.count}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
