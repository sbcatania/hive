// Small coloured illustrations for the new-game choices. Each one animates once when it
// becomes the selected option (the `on` prop), in the sketchbook's ink style. Moving
// parts turn about their own centre (transform-box: fill-box, see .part in globals.css)
// and only animate for a moment after a tap, never continuously.

import { PieceTile } from "./PieceTile";

const ink = "var(--ink)";
const honey = "var(--accent)";
const blue = "var(--move)";
const red = "var(--threat)";

/** A friendly robot: honey antenna that bobs, blinking eyes. */
export function ComputerIcon({ on }: { on?: boolean }) {
  return (
    <svg viewBox="0 0 40 40" className={`h-9 w-9 ${on ? "anim-bob" : ""}`} aria-hidden>
      <path d="M20 9V5" stroke={ink} strokeWidth={2} strokeLinecap="round" />
      <circle cx="20" cy="4.5" r="2.6" fill={honey} stroke={ink} strokeWidth={1.6} />
      <rect x="7.5" y="10" width="25" height="20" rx="7" fill="var(--card)" stroke={ink} strokeWidth={2} />
      <rect x="11.5" y="14.5" width="17" height="10" rx="4" fill={ink} opacity={0.88} />
      <g className={`part ${on ? "anim-blink" : ""}`}>
        <circle cx="16" cy="19.5" r="1.8" fill={honey} />
        <circle cx="24" cy="19.5" r="1.8" fill={honey} />
      </g>
      <path d="M4.5 18v5M35.5 18v5" stroke={ink} strokeWidth={2} strokeLinecap="round" />
      <path d="M14 34h12" stroke={ink} strokeWidth={2} strokeLinecap="round" />
    </svg>
  );
}

/** A phone passed between two players (blue and red arrows). */
export function PassIcon({ on }: { on?: boolean }) {
  return (
    <svg viewBox="0 0 40 40" className="h-9 w-9 overflow-visible" aria-hidden>
      <path d="M6 13c2-5 6-7 10-7" fill="none" stroke={blue} strokeWidth={2.2} strokeLinecap="round" />
      <path d="M13.5 3.5 16.5 6l-3 3" fill="none" stroke={blue} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M34 27c-2 5-6 7-10 7" fill="none" stroke={red} strokeWidth={2.2} strokeLinecap="round" />
      <path d="M26.5 36.5 23.5 34l3-3" fill="none" stroke={red} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      <g className={`part ${on ? "anim-pass" : ""}`}>
        <rect x="13" y="9.5" width="14" height="21" rx="3.5" fill="var(--card)" stroke={ink} strokeWidth={2} />
        {/* the tile on screen spins as the phone changes hands */}
        <path className={`part ${on ? "anim-spin" : ""}`} d="m20 15.5 3.5 2v4l-3.5 2-3.5-2v-4z" fill={honey} stroke={ink} strokeWidth={1.4} strokeLinejoin="round" />
        <path d="M18 27h4" stroke={ink} strokeWidth={1.6} strokeLinecap="round" />
      </g>
    </svg>
  );
}

/** Two linked hexes with a signal pulse. */
export function OnlineIcon({ on }: { on?: boolean }) {
  return (
    <svg viewBox="0 0 40 40" className="h-9 w-9 overflow-visible" aria-hidden>
      <path d="m12 14 6 3.5v7L12 28l-6-3.5v-7z" fill="var(--card)" stroke={ink} strokeWidth={2} strokeLinejoin="round" />
      <path d="m28 12 6 3.5v7L28 26l-6-3.5v-7z" fill={honey} fillOpacity={0.55} stroke={ink} strokeWidth={2} strokeLinejoin="round" />
      <path d="M17 21.5h6" stroke={blue} strokeWidth={2.4} strokeLinecap="round" strokeDasharray="2 3" className={on ? "anim-dash" : ""} />
      <path className={`part ${on ? "anim-ping" : ""}`} d="M33 6.5a8 8 0 0 1 4 4M31 9a4.5 4.5 0 0 1 2.4 2.4" fill="none" stroke={blue} strokeWidth={1.8} strokeLinecap="round" opacity={on ? 1 : 0.5} />
    </svg>
  );
}

/** Difficulty as 1-4 little hexes, warming from honey to red. */
export function LevelPips({ n, on }: { n: number; on?: boolean }) {
  const color = n >= 4 ? red : n === 3 ? "color-mix(in oklab, var(--accent) 45%, var(--threat))" : honey;
  return (
    <svg viewBox="0 0 46 10" className={`mx-auto h-2.5 w-[46px] ${on ? "anim-boop" : ""}`} aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <path
          key={i}
          d={`m${5.5 + i * 11.5} 1 4 2.25v4.5l-4 2.25-4-2.25v-4.5z`}
          fill={i < n ? color : "none"}
          stroke={i < n ? color : "var(--line-strong)"}
          strokeWidth={1.3}
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}

/** Clock choice: an open-ended loop for untimed, else a clock face whose share fills
 * in. Picking one draws it: the loop is inked in, the clock's hand sweeps round to its
 * time and the wedge fills behind it. */
export function ClockIcon({ minutes, on }: { minutes: number | null; on?: boolean }) {
  if (!minutes) {
    return (
      <svg viewBox="0 0 24 14" className="h-3.5 w-6" aria-hidden>
        <path d="M12 7c-2.5-4-8-4-8 0s5.5 4 8 0 8-4 8 0-5.5 4-8 0Z" pathLength={1} className={on ? "anim-draw" : ""} fill="none" stroke={on ? blue : "var(--ink-soft)"} strokeWidth={1.8} strokeLinecap="round" />
      </svg>
    );
  }
  const f = Math.min(1, minutes / 20);
  return (
    <svg viewBox="0 0 14 14" className="h-3.5 w-3.5 overflow-visible" aria-hidden>
      {/* the wedge: a fat dashed stroke round a small circle, so it can sweep */}
      <circle
        cx="7"
        cy="7"
        r="2.75"
        fill="none"
        stroke={on ? honey : "var(--line-strong)"}
        strokeWidth={5.5}
        pathLength={100}
        strokeDasharray={`${f * 100} 100`}
        transform="rotate(-90 7 7)"
        className={on ? "anim-sweep" : ""}
      />
      <circle cx="7" cy="7" r="5.8" fill="none" stroke={on ? ink : "var(--ink-soft)"} strokeWidth={1.4} />
      {on && <line x1="7" y1="7" x2="7" y2="1.9" stroke={ink} strokeWidth={1.2} strokeLinecap="round" className="anim-hand" style={{ transformOrigin: "7px 7px", transform: `rotate(${f * 360}deg)` }} />}
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
        <path d="m11 9 5 2.9v5.8L11 20.6l-5-2.9v-5.8z" fill="var(--card)" stroke={ink} strokeWidth={1.7} strokeLinejoin="round" />
        <path d="m21 14.8 5 2.9v5.8l-5 2.9-5-2.9v-5.8z" fill={honey} fillOpacity={0.55} stroke={ink} strokeWidth={1.7} strokeLinejoin="round" />
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
      {art[id] ?? art.official}
    </svg>
  );
}
