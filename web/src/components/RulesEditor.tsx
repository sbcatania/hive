"use client";

import { MiniTile } from "./PieceTile";
import { BUG_NAMES, BUG_ORDER, STANDARD_COUNTS, type BugLetter, type Rules } from "@/lib/engine-types";
import { describeVariants, PRESETS } from "@/lib/variants";
import { Icon } from "./Icon";

function Tile({ bug, size = 36, off }: { bug: BugLetter; size?: number; off?: boolean }) {
  return <MiniTile bug={bug} size={size} seed={bug.charCodeAt(0)} className={off ? "opacity-30 grayscale" : ""} />;
}

export function ExpansionToggles({ rules, onChange }: { rules: Rules; onChange: (r: Rules) => void }) {
  const items: { key: "mosquito" | "ladybug" | "pillbug"; bug: BugLetter; text: string }[] = [
    { key: "mosquito", bug: "M", text: "Copies any bug it touches" },
    { key: "ladybug", bug: "L", text: "Two steps over the top, one down" },
    { key: "pillbug", bug: "P", text: "Lifts neighbours over itself" },
  ];
  return (
    <div className="grid grid-cols-3 gap-2">
      {items.map((x) => {
        const on = rules[x.key];
        return (
          <button
            key={x.key}
            onClick={() => onChange({ ...rules, [x.key]: !on })}
            aria-pressed={on}
            className={`pencil flex flex-col items-center gap-1 px-1 py-2 text-center text-sm transition sm:flex-row sm:gap-3 sm:p-2.5 sm:text-left ${on ? "pencil-honey" : "pencil-clear pencil-dashed"}`}
          >
            <Tile bug={x.bug} off={!on} />
            <div className="min-w-0">
              <div className="flex h-6 items-center justify-center gap-1 leading-none font-semibold sm:justify-start sm:gap-2">
                {BUG_NAMES[x.bug]}
                <span className="inline-flex h-5 w-7 items-center justify-center">
                  {on ? <Icon name="check" size={16} className="text-move" /> : <span className="font-hand text-base leading-none font-normal text-muted">off</span>}
                </span>
              </div>
              <div className="hidden text-xs text-muted sm:block">{x.text}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function Stepper({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="pencil pencil-clear inline-flex items-center">
      <button className="grid h-9 w-9 place-items-center text-ink-soft hover:text-ink disabled:opacity-30" disabled={value <= min} onClick={() => onChange(value - 1)} aria-label="Fewer">
        <Icon name="minus" size={16} />
      </button>
      <span className="w-5 text-center text-sm font-semibold tabular-nums">{value}</span>
      <button className="grid h-9 w-9 place-items-center text-ink-soft hover:text-ink disabled:opacity-30" disabled={value >= max} onClick={() => onChange(value + 1)} aria-label="More">
        <Icon name="plus" size={16} />
      </button>
    </div>
  );
}

/** The "Advanced rules" drawer: presets plus every variant knob. */
export function AdvancedRules({ rules, onChange }: { rules: Rules; onChange: (r: Rules) => void }) {
  const changes = describeVariants(rules);
  const expOn = (b: BugLetter) => (b === "M" ? rules.mosquito : b === "L" ? rules.ladybug : b === "P" ? rules.pillbug : true);
  return (
    <details className="group card !bg-paper-2/50 !p-0" open={changes.length > 0 ? undefined : undefined}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
        <div>
          <div className="font-semibold">Advanced rules &amp; variants</div>
          <div className="text-xs text-muted">{changes.length ? changes.join(" · ") : "Official tournament rules"}</div>
        </div>
        <Icon name="chevron" className="shrink-0 text-muted transition group-open:rotate-180" />
      </summary>
      <div className="space-y-5 border-t border-dashed border-line-strong px-4 py-4">
        <div>
          <span className="label">Presets</span>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button key={p.id} className="pencil px-3 py-2 text-left text-sm transition hover:[--fill:var(--card-2)]" onClick={() => onChange(p.apply(rules))} title={p.blurb}>
                <div className="font-semibold">{p.name}</div>
                <div className="max-w-52 text-xs text-muted">{p.blurb}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" className="mt-0.5" checked={rules.tournament} onChange={(e) => onChange({ ...rules, tournament: e.target.checked })} />
            <span>
              <span className="font-medium">Tournament opening</span>
              <span className="block text-xs text-muted">No Queen on either player&apos;s first turn (official).</span>
            </span>
          </label>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" className="mt-0.5" checked={rules.repetitionDraw} onChange={(e) => onChange({ ...rules, repetitionDraw: e.target.checked })} />
            <span>
              <span className="font-medium">Threefold repetition is a draw</span>
              <span className="block text-xs text-muted">Stops games where both sides shuffle forever.</span>
            </span>
          </label>
          <div className="text-sm">
            <div className="font-medium">Queen must be placed by turn</div>
            <div className="mt-1 seg">
              {[2, 3, 4, 5, 6].map((n) => (
                <button key={n} aria-pressed={rules.queenDeadline === n} disabled={n < 2 && rules.tournament} onClick={() => onChange({ ...rules, queenDeadline: n })}>
                  {n}
                  {n === 4 ? "·" : ""}
                </button>
              ))}
            </div>
          </div>
          <div className="text-sm">
            <div className="font-medium">A Queen is captured when surrounded on</div>
            <div className="mt-1 seg">
              {[6, 5].map((n) => (
                <button key={n} aria-pressed={rules.surround === n} onClick={() => onChange({ ...rules, surround: n })}>
                  {n} sides{n === 6 ? " ·" : ""}
                </button>
              ))}
            </div>
          </div>
          <div className="text-sm sm:col-span-2">
            <div className="font-medium">Turn limit</div>
            <div className="text-xs text-muted">When reached, the player whose Queen is less surrounded wins (equal = draw).</div>
            <div className="mt-1 seg">
              {[0, 20, 30, 40, 60].map((n) => (
                <button key={n} aria-pressed={rules.turnLimit === n} onClick={() => onChange({ ...rules, turnLimit: n })}>
                  {n === 0 ? "None ·" : `${n} turns`}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <span className="label">Pieces per player</span>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {BUG_ORDER.map((b, i) => {
              const on = expOn(b);
              return (
                <div key={b} className={`pencil pencil-clear flex items-center justify-between gap-2 px-2 py-1.5 ${on ? "" : "opacity-40"}`}>
                  <div className="flex min-w-0 items-center gap-1.5">
                    <Tile bug={b} size={28} />
                    <span className="truncate text-xs font-medium">{BUG_NAMES[b]}</span>
                  </div>
                  {b === "Q" ? (
                    <span className="px-2 text-sm font-semibold">1</span>
                  ) : (
                    <Stepper
                      value={on ? rules.counts[i] : 0}
                      min={0}
                      max={STANDARD_COUNTS[i]}
                      onChange={(v) => {
                        const counts = [...rules.counts];
                        counts[i] = v;
                        onChange({ ...rules, counts });
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-muted">Expansion pieces are switched on and off above. Variants are played by the CPU too, but rated games use the official rules.</p>
        </div>
      </div>
    </details>
  );
}
