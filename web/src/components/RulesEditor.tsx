"use client";

import { BugGlyph } from "./BugGlyph";
import { roundedHexPath, TILE } from "@/lib/themes";
import { BUG_NAMES, BUG_ORDER, STANDARD_COUNTS, type BugLetter, type Rules } from "@/lib/engine-types";
import { describeVariants, PRESETS } from "@/lib/variants";

function MiniTile({ bug, size = 36, off }: { bug: BugLetter; size?: number; off?: boolean }) {
  const t = TILE.w;
  return (
    <svg viewBox="-50 -50 100 100" width={size} height={size} className={`shrink-0 ${off ? "opacity-30 grayscale" : ""}`} aria-hidden>
      <path d={roundedHexPath(0, 3, 46, 0.2)} fill={t.side} />
      <path d={roundedHexPath(0, 0, 46, 0.2)} fill={t.fill} stroke={t.edge} strokeWidth={3} />
      <g transform="translate(-29 -29) scale(0.58)">
        <BugGlyph bug={bug} ink={t.ink} />
      </g>
    </svg>
  );
}

export function ExpansionToggles({ rules, onChange }: { rules: Rules; onChange: (r: Rules) => void }) {
  const items: { key: "mosquito" | "ladybug" | "pillbug"; bug: BugLetter; text: string }[] = [
    { key: "mosquito", bug: "M", text: "Copies any bug it touches" },
    { key: "ladybug", bug: "L", text: "Two steps over the top, one down" },
    { key: "pillbug", bug: "P", text: "Lifts neighbours over itself" },
  ];
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {items.map((x) => {
        const on = rules[x.key];
        return (
          <button
            key={x.key}
            onClick={() => onChange({ ...rules, [x.key]: !on })}
            aria-pressed={on}
            className={`flex items-center gap-3 rounded-xl border p-2.5 text-left text-sm transition ${on ? "border-accent bg-accent-soft/50 ring-1 ring-accent/30" : "border-line bg-paper-2/60 hover:border-line-strong"}`}
          >
            <MiniTile bug={x.bug} off={!on} />
            <div className="min-w-0">
              <div className="flex items-center gap-2 font-semibold">
                {BUG_NAMES[x.bug]}
                <span className={`rounded-full px-1.5 text-[10px] font-bold uppercase ${on ? "bg-accent text-accent-ink" : "bg-line text-muted"}`}>{on ? "on" : "off"}</span>
              </div>
              <div className="text-xs text-muted">{x.text}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function Stepper({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="inline-flex items-center rounded-lg border border-line bg-paper">
      <button className="px-2 py-1 text-ink-soft hover:text-ink disabled:opacity-30" disabled={value <= min} onClick={() => onChange(value - 1)} aria-label="Fewer">
        −
      </button>
      <span className="w-5 text-center font-mono text-sm tabular-nums">{value}</span>
      <button className="px-2 py-1 text-ink-soft hover:text-ink disabled:opacity-30" disabled={value >= max} onClick={() => onChange(value + 1)} aria-label="More">
        +
      </button>
    </div>
  );
}

/** The "Advanced rules" drawer: presets plus every variant knob. */
export function AdvancedRules({ rules, onChange }: { rules: Rules; onChange: (r: Rules) => void }) {
  const changes = describeVariants(rules);
  const expOn = (b: BugLetter) => (b === "M" ? rules.mosquito : b === "L" ? rules.ladybug : b === "P" ? rules.pillbug : true);
  return (
    <details className="group rounded-2xl border border-line bg-paper-2/50" open={changes.length > 0 ? undefined : undefined}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
        <div>
          <div className="font-semibold">Advanced rules &amp; variants</div>
          <div className="text-xs text-muted">{changes.length ? changes.join(" · ") : "Official tournament rules"}</div>
        </div>
        <span className="text-muted transition group-open:rotate-180">▾</span>
      </summary>
      <div className="space-y-5 border-t border-line px-4 py-4">
        <div>
          <span className="label">Presets</span>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button key={p.id} className="rounded-xl border border-line bg-card px-3 py-2 text-left text-sm transition hover:border-accent" onClick={() => onChange(p.apply(rules))} title={p.blurb}>
                <div className="font-semibold">{p.name}</div>
                <div className="max-w-52 text-xs text-muted">{p.blurb}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--accent)]" checked={rules.tournament} onChange={(e) => onChange({ ...rules, tournament: e.target.checked })} />
            <span>
              <span className="font-medium">Tournament opening</span>
              <span className="block text-xs text-muted">No Queen on either player&apos;s first turn (official).</span>
            </span>
          </label>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--accent)]" checked={rules.repetitionDraw} onChange={(e) => onChange({ ...rules, repetitionDraw: e.target.checked })} />
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
                <div key={b} className={`flex items-center justify-between gap-2 rounded-xl border border-line bg-card px-2 py-1.5 ${on ? "" : "opacity-40"}`}>
                  <div className="flex min-w-0 items-center gap-1.5">
                    <MiniTile bug={b} size={28} />
                    <span className="truncate text-xs font-medium">{BUG_NAMES[b]}</span>
                  </div>
                  {b === "Q" ? (
                    <span className="px-2 font-mono text-sm">1</span>
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
