"use client";

// Small coloured illustrations for the new-game choices, drawn like the rest of the
// sketchbook (a faint second pencil pass, wobbly hexes: see Sketchy). Each one plays a
// little scene when it becomes the selected option (`on`), and has a smaller idle moment
// every few seconds (a blink, a nudge, a ping): one-shot animations replayed by a timer,
// so nothing animates in between. Moving parts turn about their own centre (.part).

import { useEffect, useState } from "react";
import { PieceTile } from "./PieceTile";
import { Drawn, hex, useTicker } from "./Sketchy";

const ink = "var(--ink)";
const honey = "var(--accent)";
const blue = "var(--move)";
const red = "var(--threat)";

/** A friendly robot that blinks now and then (twice, and bobs, when picked). */
export function ComputerIcon({ on }: { on?: boolean }) {
  const blink = useTicker(4300, 1800);
  return (
    <svg viewBox="0 0 40 40" className={`h-9 w-9 overflow-visible ${on ? "anim-bob" : ""}`} aria-hidden>
      <Drawn>
        <path d="M20 9.5V5.5" stroke={ink} strokeWidth={2} strokeLinecap="round" />
        <circle cx="20.2" cy="4.6" r="2.6" fill={honey} stroke={ink} strokeWidth={1.6} />
        <path d="M14.3 10.2c4-.4 8-.5 11.6-.1 4 .4 6.6 2.8 6.7 6.6.1 2.4 0 4.6-.2 6.7-.4 3.9-3 6.4-7 6.6-3.8.2-7.6.1-11.2-.1-3.8-.3-6.4-2.8-6.6-6.5-.1-2.3-.1-4.6.1-6.9.4-3.8 2.9-5.9 6.6-6.3Z" fill="var(--card)" stroke={ink} strokeWidth={2} strokeLinejoin="round" />
        <path d="M4.6 18.2v4.9M35.4 17.9v5.1" stroke={ink} strokeWidth={2} strokeLinecap="round" />
        <path d="M14.2 34.1c3.9-.3 7.7-.3 11.6 0" stroke={ink} strokeWidth={2} strokeLinecap="round" fill="none" />
      </Drawn>
      <rect x="11.5" y="14.5" width="17" height="10" rx="4" fill={ink} opacity={0.88} />
      <g key={`${on}-${blink}`} className={`part ${on ? "anim-blink" : blink ? "anim-blink-once" : ""}`}>
        <circle cx="16" cy="19.5" r="1.8" fill={honey} />
        <circle cx="24" cy="19.5" r="1.8" fill={honey} />
      </g>
    </svg>
  );
}

/** A phone passed between two players (blue and red arrows). Picked, it swings across
 * with its tile spinning; idle, it gives a small nudge now and then. */
export function PassIcon({ on }: { on?: boolean }) {
  const nudge = useTicker(7100, 3600);
  return (
    <svg viewBox="0 0 40 40" className="h-9 w-9 overflow-visible" aria-hidden>
      <Drawn>
        <path d="M6 13.2c2.1-4.8 5.8-7.1 10.2-7" fill="none" stroke={blue} strokeWidth={2.2} strokeLinecap="round" />
        <path d="M13.6 3.4 16.6 6l-3.1 2.9" fill="none" stroke={blue} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
        <path d="M34 26.8c-2 5-5.9 7.2-10.1 7.2" fill="none" stroke={red} strokeWidth={2.2} strokeLinecap="round" />
        <path d="M26.4 36.6 23.5 34l3.1-2.9" fill="none" stroke={red} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      </Drawn>
      <g key={`${on}-${nudge}`} className={`part ${on ? "anim-pass" : nudge ? "anim-nudge" : ""}`}>
        <Drawn>
          <path d="M16.6 9.6c2.3-.2 4.7-.2 7 0 2 .2 3.3 1.5 3.4 3.5.2 4.6.2 9.2 0 13.8-.1 2-1.4 3.3-3.4 3.5-2.3.2-4.7.2-7 0-2-.2-3.4-1.5-3.5-3.5-.2-4.6-.2-9.2 0-13.8.1-2 1.5-3.3 3.5-3.5Z" fill="var(--card)" stroke={ink} strokeWidth={2} strokeLinejoin="round" />
          <path d="M18 27.1c1.3-.1 2.7-.1 4 0" stroke={ink} strokeWidth={1.6} strokeLinecap="round" fill="none" />
        </Drawn>
        {/* the tile on screen spins as the phone changes hands */}
        <path className={`part ${on ? "anim-spin" : ""}`} d={hex(20, 19.5, 4.1, 5)} fill={honey} stroke={ink} strokeWidth={1.4} strokeLinejoin="round" />
      </g>
    </svg>
  );
}

/** Two linked tiles with a signal. Picked: the link flows across, the far tile pulses
 * and the signal lights up arc by arc. Idle: the signal lights up now and then. */
export function OnlineIcon({ on }: { on?: boolean }) {
  const ping = useTicker(5200, 2600);
  const k = `${on}-${ping}`;
  return (
    <svg viewBox="0 0 40 40" className="h-9 w-9 overflow-visible" aria-hidden>
      <Drawn>
        <path d={hex(12, 21, 7.4, 3)} fill="var(--card)" stroke={ink} strokeWidth={2} strokeLinejoin="round" />
      </Drawn>
      <g key={`t-${on}`} className={`part ${on ? "anim-pulse" : ""}`}>
        <Drawn>
          <path d={hex(28, 19, 7.4, 8)} fill={honey} fillOpacity={0.55} stroke={ink} strokeWidth={2} strokeLinejoin="round" />
        </Drawn>
      </g>
      <path key={`l-${on}`} d="M17.4 20.6c1.8-.4 3.6-.6 5.3-.6" stroke={blue} strokeWidth={2.4} strokeLinecap="round" strokeDasharray="2 2.6" className={on ? "anim-flow" : ""} fill="none" />
      <path key={`a-${k}`} className={on || ping ? "anim-signal" : ""} d="M31.2 9.1c1.1.5 1.9 1.3 2.4 2.4" fill="none" stroke={blue} strokeWidth={1.8} strokeLinecap="round" opacity={0.55} />
      <path key={`b-${k}`} className={on || ping ? "anim-signal-late" : ""} d="M33 6.4c2 .9 3.4 2.3 4.2 4.3" fill="none" stroke={blue} strokeWidth={1.8} strokeLinecap="round" opacity={0.55} />
    </svg>
  );
}

/** Difficulty as 1-4 little hexes, warming from honey to red. */
export function LevelPips({ n, on }: { n: number; on?: boolean }) {
  const color = n >= 4 ? red : n === 3 ? "color-mix(in oklab, var(--accent) 45%, var(--threat))" : honey;
  return (
    <svg viewBox="0 0 46 10" className="mx-auto h-2.5 w-[46px] overflow-visible" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        // Picked, the level's hexes pop in one after another.
        <path
          key={`${i}-${on}`}
          d={`m${5.5 + i * 11.5} 1 4 2.25v4.5l-4 2.25-4-2.25v-4.5z`}
          fill={i < n ? color : "none"}
          stroke={i < n ? color : "var(--line-strong)"}
          strokeWidth={1.3}
          strokeLinejoin="round"
          className={`part ${on && i < n ? "anim-pop" : ""}`}
          style={on ? { animationDelay: `${i * 80}ms` } : undefined}
        />
      ))}
    </svg>
  );
}

/** Clock choice: an open-ended loop for untimed, else a dial whose share fills in. */
export function ClockIcon({ minutes, on }: { minutes: number | null; on?: boolean }) {
  return <Dial fraction={minutes ? Math.min(1, minutes / 20) : null} on={on} />;
}

/** Sweeps a value from 0 up to `target` (with an ease-out) each time `on` turns true;
 * otherwise sits at `target`. One timeline, so everything drawn from it stays in step. */
function useSweep(target: number, on?: boolean) {
  const [v, setV] = useState(target);
  useEffect(() => {
    if (!on || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return setV(target);
    let raf = 0;
    const t0 = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / 650);
      setV(target * (1 - (1 - t) ** 3));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    setV(0);
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [on, target]);
  return v;
}

/** A small dial: a share of the circle filled, with a hand at its edge. `null` draws the
 * infinity loop (no limit). Picked, the hand sweeps round and the wedge fills exactly
 * behind it (both drawn from the same angle each frame). */
export function Dial({ fraction, on }: { fraction: number | null; on?: boolean }) {
  const f = useSweep(fraction ?? 0, on && fraction !== null);
  if (fraction === null) {
    return (
      <svg viewBox="0 0 24 14" className="h-3.5 w-6" aria-hidden>
        <path d="M12 7c-2.5-4-8-4-8 0s5.5 4 8 0 8-4 8 0-5.5 4-8 0Z" pathLength={1} className={on ? "anim-draw" : ""} fill="none" stroke={on ? blue : "var(--ink-soft)"} strokeWidth={1.8} strokeLinecap="round" />
      </svg>
    );
  }
  const a = f * 2 * Math.PI;
  const x = 7 + 5.5 * Math.sin(a);
  const y = 7 - 5.5 * Math.cos(a);
  const fill = on ? honey : "var(--line-strong)";
  return (
    <svg viewBox="0 0 14 14" className="h-3.5 w-3.5 overflow-visible" aria-hidden>
      {f >= 0.999 ? <circle cx="7" cy="7" r="5.5" fill={fill} /> : f > 0.001 && <path d={`M7 7V1.5A5.5 5.5 0 ${f > 0.5 ? 1 : 0} 1 ${x.toFixed(2)} ${y.toFixed(2)}Z`} fill={fill} />}
      <circle cx="7" cy="7" r="5.8" fill="none" stroke={on ? ink : "var(--ink-soft)"} strokeWidth={1.4} />
      {on && <line x1="7" y1="7" x2={(7 + 5 * Math.sin(a)).toFixed(2)} y2={(7 - 5 * Math.cos(a)).toFixed(2)} stroke={ink} strokeWidth={1.2} strokeLinecap="round" />}
    </svg>
  );
}

/** Which side you play: a tiny Queen tile in that colour, or one of each for random. */
export function SideIcon({ side, on }: { side: "w" | "b" | "random"; on?: boolean }) {
  const tile = (c: "w" | "b", x: number, y: number, seed: number) => <PieceTile bug="Q" color={c} x={x} y={y} size={21} seed={seed} />;
  return (
    <svg viewBox={side === "random" ? "-24 -24 68 48" : "-24 -24 48 48"} className={`h-6 ${side === "random" ? "w-[34px]" : "w-6"} overflow-visible ${on ? "anim-boop" : ""}`} aria-hidden>
      {side === "random" ? (
        <>
          <g transform="rotate(-8 0 0)">{tile("w", 0, 0, 3)}</g>
          <g transform="rotate(7 20 2)">{tile("b", 20, 2, 5)}</g>
        </>
      ) : (
        tile(side, 0, 0, side === "w" ? 3 : 5)
      )}
    </svg>
  );
}

/** A little drawing for each rules preset. */
export function PresetIcon({ id }: { id: string }) {
  const art: Record<string, React.ReactNode> = {
    // A rosette: the rules as published.
    official: (
      <>
        <path d="M12 21 9 30l4-2 2 3 1.5-9M20 21l3 9-4-2-2 3-1.5-9" fill={red} fillOpacity={0.75} stroke={ink} strokeWidth={1.4} strokeLinejoin="round" />
        <circle cx="16" cy="14" r="8.5" fill={honey} fillOpacity={0.7} stroke={ink} strokeWidth={1.8} />
        <circle cx="16" cy="14" r="4.5" fill="var(--card)" stroke={ink} strokeWidth={1.4} />
      </>
    ),
    // Fewer pieces: a small, light hive.
    lite: (
      <>
        <path d={hex(11, 14.8, 5.8, 2)} fill="var(--card)" stroke={ink} strokeWidth={1.7} strokeLinejoin="round" />
        <path d={hex(21, 20.6, 5.8, 6)} fill={honey} fillOpacity={0.55} stroke={ink} strokeWidth={1.7} strokeLinejoin="round" />
        <path d="M24 4.5c-3 .5-5 3-5 6 3-.3 5-2.8 5-6Z" fill={blue} fillOpacity={0.6} stroke={blue} strokeWidth={1.2} strokeLinejoin="round" />
      </>
    ),
    // Swarm: a Queen with five of six sides taken.
    blitz: (
      <>
        {[0, 1, 2, 3, 4, 5].map((i) => {
          const a = (i * Math.PI) / 3 + Math.PI / 6;
          const x = 16 + Math.cos(a) * 9.2;
          const y = 16 + Math.sin(a) * 9.2;
          return <circle key={i} cx={x} cy={y} r={3.6} fill={i < 5 ? red : "none"} fillOpacity={0.7} stroke={i < 5 ? ink : "var(--line-strong)"} strokeWidth={1.3} strokeDasharray={i < 5 ? undefined : "1.5 1.5"} />;
        })}
        <circle cx="16" cy="16" r="4.2" fill={honey} stroke={ink} strokeWidth={1.5} />
      </>
    ),
    // Sundown: the sun setting on a turn limit.
    marathon: (
      <>
        <path d="M6 21a10 10 0 0 1 20 0Z" fill={honey} fillOpacity={0.75} stroke={ink} strokeWidth={1.7} strokeLinejoin="round" />
        <path d="M16 6.5v2.5M6.5 10.5l1.8 1.8M25.5 10.5l-1.8 1.8M3.5 21h25" stroke={ink} strokeWidth={1.6} strokeLinecap="round" />
        <path d="M8 25h16M11 28.5h10" stroke={blue} strokeWidth={1.6} strokeLinecap="round" opacity={0.75} />
      </>
    ),
    // Early Queen: a crown with a quick-time tick.
    early: (
      <>
        <path d="m6 23-1.5-11 6 5L16 8l5.5 9 6-5L26 23Z" fill={honey} fillOpacity={0.75} stroke={ink} strokeWidth={1.7} strokeLinejoin="round" />
        <path d="M6.5 27h19" stroke={ink} strokeWidth={1.7} strokeLinecap="round" />
        <circle cx="16" cy="18.5" r="1.8" fill={red} />
      </>
    ),
  };
  return (
    <svg viewBox="0 0 32 32" className="h-9 w-9 shrink-0" aria-hidden>
      <Drawn>{art[id] ?? art.official}</Drawn>
    </svg>
  );
}

export type RuleIconName = "tournament" | "repetition" | "deadline" | "surround" | "turnLimit" | "pieces";

/** A small drawing beside each rule in the advanced drawer. */
export function RuleIcon({ name }: { name: RuleIconName }) {
  const art: Record<RuleIconName, React.ReactNode> = {
    // The opening: a crown held back, with a "1" for the first turn.
    tournament: (
      <>
        <path d="m5 19-1.2-9 5 4L13 6.5l4.2 7.5 5-4L21 19Z" fill={honey} fillOpacity={0.7} stroke={ink} strokeWidth={1.6} strokeLinejoin="round" />
        <path d="M5.5 22.5c5-.3 10-.3 15 0" stroke={ink} strokeWidth={1.6} strokeLinecap="round" fill="none" />
        <path d="M3.5 4.5 22.5 23" stroke={red} strokeWidth={1.8} strokeLinecap="round" />
      </>
    ),
    // Going round in circles: three arrows chasing each other.
    repetition: (
      <>
        <path d="M13 4.5a8.5 8.5 0 0 1 8.2 6.3M21.4 15.4a8.5 8.5 0 0 1-7 6.9M9.4 21.2a8.5 8.5 0 0 1-4.8-8.8" fill="none" stroke={blue} strokeWidth={1.8} strokeLinecap="round" />
        <path d="m19 10.2 2.3 1 .9-2.4M15.6 23.2l-1.4-1.9 1.9-1.6M3.5 14.6l1.2-2.2 2.5.6" fill="none" stroke={blue} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
        <path d={hex(13, 13.5, 3.6, 4)} fill={honey} stroke={ink} strokeWidth={1.3} strokeLinejoin="round" />
      </>
    ),
    // The Queen arriving by a deadline: a crown over a small hourglass.
    deadline: (
      <>
        <path d="m4 13.5-1-6.5 4 3L11 3.5 14.5 10l4-3-1 6.5Z" fill={honey} fillOpacity={0.7} stroke={ink} strokeWidth={1.5} strokeLinejoin="round" />
        <path d="M14 15.5h8.5M14 24.5h8.5M15 15.5c0 3.5 4.5 3.5 4.5 4.5S15 21 15 24.5M21.5 15.5c0 3.5-4.5 3.5-4.5 4.5s4.5 1 4.5 4.5" fill="none" stroke={ink} strokeWidth={1.4} strokeLinecap="round" />
        <path d="M16.5 23.5c.8-1.5 2.7-1.5 3.5 0Z" fill={honey} />
      </>
    ),
    // A Queen in a ring of tiles.
    surround: (
      <>
        {[0, 1, 2, 3, 4, 5].map((i) => {
          const a = (i * Math.PI) / 3 - Math.PI / 2;
          return <path key={i} d={hex(13 + Math.cos(a) * 8.2, 13.5 + Math.sin(a) * 8.2, 3.6, i + 2)} fill={i < 5 ? "var(--card)" : "none"} stroke={i < 5 ? ink : "var(--line-strong)"} strokeWidth={1.3} strokeDasharray={i < 5 ? undefined : "1.5 1.5"} strokeLinejoin="round" />;
        })}
        <path d={hex(13, 13.5, 3.6, 9)} fill={honey} stroke={ink} strokeWidth={1.4} strokeLinejoin="round" />
      </>
    ),
    // A sun going down on the game.
    turnLimit: (
      <>
        <path d="M5 18a8 8 0 0 1 16 0Z" fill={honey} fillOpacity={0.75} stroke={ink} strokeWidth={1.5} strokeLinejoin="round" />
        <path d="M13 5.5v2.2M5.2 9.2l1.5 1.5M20.8 9.2l-1.5 1.5M2.5 18h21" stroke={ink} strokeWidth={1.5} strokeLinecap="round" />
        <path d="M7 21.5h12M10 24.5h6" stroke={blue} strokeWidth={1.5} strokeLinecap="round" opacity={0.75} />
      </>
    ),
    // A little stack of tiles.
    pieces: (
      <>
        <path d={hex(9, 16.5, 5.4, 3)} fill="var(--card)" stroke={ink} strokeWidth={1.5} strokeLinejoin="round" />
        <path d={hex(17.5, 16.5, 5.4, 6)} fill="var(--card)" stroke={ink} strokeWidth={1.5} strokeLinejoin="round" />
        <path d={hex(13.2, 9, 5.4, 8)} fill={honey} fillOpacity={0.6} stroke={ink} strokeWidth={1.5} strokeLinejoin="round" />
      </>
    ),
  };
  return (
    <svg viewBox="0 0 26 27" className="h-6 w-6 shrink-0" aria-hidden>
      <Drawn>{art[name]}</Drawn>
    </svg>
  );
}

/** A Queen ringed by `n` of her six neighbours (for the capture rule's options). */
export function SurroundIcon({ n, on }: { n: number; on?: boolean }) {
  return (
    <svg viewBox="0 0 26 26" className={`h-[18px] w-[18px] overflow-visible ${on ? "anim-boop" : ""}`} aria-hidden>
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const a = (i * Math.PI) / 3 - Math.PI / 2;
        const filled = i < n;
        return <path key={i} d={hex(13 + Math.cos(a) * 8.4, 13 + Math.sin(a) * 8.4, 3.7, i + 2)} fill={filled ? (on ? red : "var(--line-strong)") : "none"} fillOpacity={filled ? 0.75 : 0} stroke={filled ? ink : "var(--line-strong)"} strokeWidth={1.2} strokeDasharray={filled ? undefined : "1.5 1.5"} strokeLinejoin="round" />;
      })}
      <path d={hex(13, 13, 3.7, 9)} fill={honey} stroke={ink} strokeWidth={1.3} strokeLinejoin="round" />
    </svg>
  );
}
