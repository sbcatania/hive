import { BUG_NAMES, BUG_ORDER, STANDARD_COUNTS, standardRules, type Rules } from "./engine-types";

export interface Preset {
  id: string;
  name: string;
  blurb: string;
  apply: (r: Rules) => Rules;
}

/** One-click variant presets for the advanced rules drawer. */
export const PRESETS: Preset[] = [
  {
    id: "official",
    name: "Official",
    blurb: "Tournament rules exactly as published.",
    apply: (r) => ({ ...standardRules({ mosquito: r.mosquito, ladybug: r.ladybug, pillbug: r.pillbug }) }),
  },
  {
    id: "lite",
    name: "Hive Lite",
    blurb: "One of each bug plus two ants: shorter games, good for learning.",
    apply: (r) => ({ ...r, counts: [1, 1, 1, 1, 2, 1, 1, 1] }),
  },
  {
    id: "blitz",
    name: "Swarm",
    blurb: "A Queen is captured when 5 of her 6 sides are covered. Aggressive and quick.",
    apply: (r) => ({ ...r, surround: 5 }),
  },
  {
    id: "marathon",
    name: "Sundown",
    blurb: "After 30 turns each, the Queen with fewer neighbours wins. No endless games.",
    apply: (r) => ({ ...r, turnLimit: 30, repetitionDraw: true }),
  },
  {
    id: "early",
    name: "Early Queen",
    blurb: "Queens must be placed by turn 3, so the fight starts sooner.",
    apply: (r) => ({ ...r, queenDeadline: 3 }),
  },
];

/** Short human-readable list of the non-standard rules in use. */
export function describeVariants(r: Rules): string[] {
  const out: string[] = [];
  const reduced = BUG_ORDER.map((b, i) => ({ b, i })).filter(({ i }) => i > 0 && r.counts[i] < STANDARD_COUNTS[i]);
  for (const { b, i } of reduced) {
    if (b === "M" && !r.mosquito) continue;
    if (b === "L" && !r.ladybug) continue;
    if (b === "P" && !r.pillbug) continue;
    out.push(r.counts[i] === 0 ? `No ${BUG_NAMES[b]}s` : `${r.counts[i]} × ${BUG_NAMES[b]}`);
  }
  if (r.queenDeadline !== 4) out.push(`Queen by turn ${r.queenDeadline}`);
  if (r.surround !== 6) out.push(`Captured on ${r.surround} sides`);
  if (r.turnLimit) out.push(`${r.turnLimit}-turn limit`);
  if (r.repetitionDraw) out.push("Threefold repetition draws");
  if (!r.tournament) out.push("Queen allowed on turn 1");
  return out;
}

export function expansionLabel(r: Rules) {
  const e = [r.mosquito && "Mosquito", r.ladybug && "Ladybug", r.pillbug && "Pillbug"].filter(Boolean);
  return e.length ? `Base + ${e.join(", ")}` : "Base game";
}
