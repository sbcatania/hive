"use client";

import { MiniTile } from "./PieceTile";
import { BUG_NAMES, BUG_ORDER, normalizeRules, STANDARD_COUNTS, type BugLetter, type Rules } from "@/lib/engine-types";
import { describeVariants, PRESETS, type Preset } from "@/lib/variants";
import { Icon } from "./Icon";
import { Dial, PresetIcon, RuleIcon, SurroundIcon } from "./SetupIcons";
import { useState } from "react";

function Tile({ bug, size = 36, off }: { bug: BugLetter; size?: number; off?: boolean }) {
  return <MiniTile bug={bug} size={size} seed={bug.charCodeAt(0)} className={off ? "opacity-30 grayscale" : ""} />;
}

export function ExpansionToggles({ rules, onChange }: { rules: Rules; onChange: (r: Rules) => void }) {
  // Each bug comes to life its own way when switched on: the mosquito buzzes, the
  // ladybug hops, the pillbug rolls. Switched off, it nods off.
  const items: { key: "mosquito" | "ladybug" | "pillbug"; bug: BugLetter; text: string; wake: string }[] = [
    { key: "mosquito", bug: "M", text: "Copies any bug it touches", wake: "anim-buzz" },
    { key: "ladybug", bug: "L", text: "Two steps over the top, one down", wake: "anim-hop" },
    { key: "pillbug", bug: "P", text: "Lifts neighbours over itself", wake: "anim-roll" },
  ];
  // Only animate after a tap, not when the screen first appears.
  const [touched, setTouched] = useState<string | null>(null);
  return (
    <div className="grid grid-cols-3 gap-2">
      {items.map((x) => {
        const on = rules[x.key];
        return (
          <button
            key={x.key}
            onClick={() => {
              setTouched(x.key);
              onChange({ ...rules, [x.key]: !on });
            }}
            aria-pressed={on}
            className={`pencil flex flex-col items-center gap-1 px-1 py-2 text-center text-sm transition sm:flex-row sm:gap-3 sm:p-2.5 sm:text-left ${on ? "pencil-honey" : "pencil-clear pencil-dashed"}`}
          >
            <span key={on ? "on" : "off"} className={`inline-block ${touched === x.key ? (on ? x.wake : "anim-doze") : ""}`}>
              <Tile bug={x.bug} off={!on} />
            </span>
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

const sameRules = (a: Rules, b: Rules) => JSON.stringify(normalizeRules(a)) === JSON.stringify(normalizeRules(b));

/** A preset is in effect when applying it would change nothing; Official only when the
 * rules are exactly the official ones (so presets combined show each one checked). */
function presetInEffect(p: Preset, rules: Rules) {
  return sameRules(p.apply(rules), rules);
}

/** Marks the official setting in a row of options. */
function OfficialMark() {
  return <span aria-label="official" className="ml-1 inline-block h-[7px] w-[6px] bg-accent align-middle [clip-path:polygon(50%_0,100%_25%,100%_75%,50%_100%,0_75%,0_25%)]" />;
}

function Stepper({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="inline-flex items-center">
      <button className="grid h-10 w-8 place-items-center text-ink-soft hover:text-ink disabled:opacity-30" disabled={value <= min} onClick={() => onChange(value - 1)} aria-label="Fewer">
        <Icon name="minus" size={16} />
      </button>
      <span className="w-5 text-center text-sm font-semibold tabular-nums">{value}</span>
      <button className="grid h-10 w-8 place-items-center text-ink-soft hover:text-ink disabled:opacity-30" disabled={value >= max} onClick={() => onChange(value + 1)} aria-label="More">
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
    <details className="group card !p-0 [--fill:color-mix(in_oklab,var(--paper-2)_50%,transparent)]">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
        <div>
          <div className="font-semibold">Advanced rules &amp; variants</div>
          <div className="text-xs text-muted">{changes.length ? changes.join(", ") : "Official tournament rules"}</div>
        </div>
        <Icon name="chevron" className="shrink-0 text-muted transition group-open:rotate-180" />
      </summary>
      <div className="space-y-5 border-t border-dashed border-line-strong px-4 py-4">
        <div>
          <span className="label">Presets</span>
          <div className="grid gap-2 sm:grid-cols-2">
            {PRESETS.map((p) => {
              const on = presetInEffect(p, rules);
              return (
                <button
                  key={p.id}
                  aria-pressed={on}
                  className={`pencil flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition ${on ? "pencil-honey" : "hover:[--fill:var(--card-2)]"}`}
                  onClick={() => onChange(p.apply(rules))}
                >
                  <PresetIcon id={p.id} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{p.name}</span>
                    <span className="block text-xs text-muted">{p.blurb}</span>
                  </span>
                  <span className="grid h-6 w-6 shrink-0 place-items-center">{on && <Icon name="check" size={18} className="anim-boop text-move" />}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" className="mt-0.5" checked={rules.tournament} onChange={(e) => onChange({ ...rules, tournament: e.target.checked })} />
            <RuleIcon name="tournament" />
            <span>
              <span className="font-medium">Tournament opening</span>
              <span className="block text-xs text-muted">No Queen on either player&apos;s first turn (official).</span>
            </span>
          </label>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" className="mt-0.5" checked={rules.repetitionDraw} onChange={(e) => onChange({ ...rules, repetitionDraw: e.target.checked })} />
            <RuleIcon name="repetition" />
            <span>
              <span className="font-medium">Threefold repetition is a draw</span>
              <span className="block text-xs text-muted">Stops games where both sides shuffle forever.</span>
            </span>
          </label>
          <div className="text-sm">
            <div className="flex items-center gap-2 font-medium">
              <RuleIcon name="deadline" />
              Queen must be placed by turn
            </div>
            <div className="mt-1 seg">
              {[2, 3, 4, 5, 6].map((n) => (
                <button key={n} className="min-w-10" aria-pressed={rules.queenDeadline === n} disabled={n < 2 && rules.tournament} onClick={() => onChange({ ...rules, queenDeadline: n })}>
                  {n}
                  {n === 4 && <OfficialMark />}
                </button>
              ))}
            </div>
          </div>
          <div className="text-sm">
            <div className="flex items-center gap-2 font-medium">
              <RuleIcon name="surround" />
              A Queen is captured when surrounded on
            </div>
            <div className="mt-1 seg">
              {[6, 5].map((n) => (
                <button key={n} className="inline-flex items-center gap-1.5" aria-pressed={rules.surround === n} onClick={() => onChange({ ...rules, surround: n })}>
                  <SurroundIcon n={n} on={rules.surround === n} />
                  {n} sides{n === 6 && <OfficialMark />}
                </button>
              ))}
            </div>
          </div>
          <div className="text-sm sm:col-span-2">
            <div className="flex items-center gap-2 font-medium">
              <RuleIcon name="turnLimit" />
              Turn limit (turns each)
            </div>
            <div className="text-xs text-muted">The less-surrounded Queen wins when it&apos;s reached.</div>
            <div className="mt-1 seg seg-fill">
              {[0, 20, 30, 40, 60].map((n) => (
                <button key={n} className="flex flex-col items-center justify-center !gap-1 !py-2" aria-pressed={rules.turnLimit === n} onClick={() => onChange({ ...rules, turnLimit: n })}>
                  <Dial fraction={n ? n / 60 : null} on={rules.turnLimit === n} />
                  <span className="whitespace-nowrap">
                    {n === 0 ? "None" : n}
                    {n === 0 && <OfficialMark />}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <span className="label flex items-center gap-2">
            <RuleIcon name="pieces" />
            Pieces per player
          </span>
          <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2 sm:grid-cols-4">
            {BUG_ORDER.map((b, i) => {
              const on = expOn(b);
              return (
                <div key={b} className={`pencil pencil-clear flex items-center justify-between gap-2 px-2 py-1.5 ${on ? "" : "opacity-40"}`}>
                  <div className="flex min-w-0 items-center gap-1.5">
                    <Tile bug={b} size={28} />
                    <span className="truncate text-xs font-medium min-[360px]:max-sm:hidden">{BUG_NAMES[b]}</span>
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
          <p className="mt-2 text-xs text-muted">
            <OfficialMark /> marks the official setting. Rated games always use the official rules.
          </p>
        </div>
      </div>
    </details>
  );
}
