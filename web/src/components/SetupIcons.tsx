// Small coloured illustrations for the new-game choices. Each one animates once when it
// becomes the selected option (the `on` prop), in the sketchbook's ink style.

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
      <g className={on ? "anim-blink" : ""} style={{ transformOrigin: "20px 19.5px" }}>
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
    <svg viewBox="0 0 40 40" className="h-9 w-9" aria-hidden>
      <path d="M6 13c2-5 6-7 10-7" fill="none" stroke={blue} strokeWidth={2.2} strokeLinecap="round" />
      <path d="M13.5 3.5 16.5 6l-3 3" fill="none" stroke={blue} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M34 27c-2 5-6 7-10 7" fill="none" stroke={red} strokeWidth={2.2} strokeLinecap="round" />
      <path d="M26.5 36.5 23.5 34l3-3" fill="none" stroke={red} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      <g className={on ? "anim-pass" : ""} style={{ transformOrigin: "20px 20px" }}>
        <rect x="13" y="9.5" width="14" height="21" rx="3.5" fill="var(--card)" stroke={ink} strokeWidth={2} />
        <path d="m20 15.5 3.5 2v4l-3.5 2-3.5-2v-4z" fill={honey} stroke={ink} strokeWidth={1.4} strokeLinejoin="round" />
        <path d="M18 27h4" stroke={ink} strokeWidth={1.6} strokeLinecap="round" />
      </g>
    </svg>
  );
}

/** Two linked hexes with a signal pulse. */
export function OnlineIcon({ on }: { on?: boolean }) {
  return (
    <svg viewBox="0 0 40 40" className="h-9 w-9" aria-hidden>
      <path d="m12 14 6 3.5v7L12 28l-6-3.5v-7z" fill="var(--card)" stroke={ink} strokeWidth={2} strokeLinejoin="round" />
      <path d="m28 12 6 3.5v7L28 26l-6-3.5v-7z" fill={honey} fillOpacity={0.55} stroke={ink} strokeWidth={2} strokeLinejoin="round" />
      <path d="M17 21.5h6" stroke={blue} strokeWidth={2.4} strokeLinecap="round" strokeDasharray="2 3" className={on ? "anim-dash" : ""} />
      <g className={on ? "anim-ping" : ""} style={{ transformOrigin: "28px 19px" }} opacity={on ? 1 : 0.5}>
        <path d="M33 6.5a8 8 0 0 1 4 4M31 9a4.5 4.5 0 0 1 2.4 2.4" fill="none" stroke={blue} strokeWidth={1.8} strokeLinecap="round" />
      </g>
    </svg>
  );
}

/** Difficulty as 1-4 little hexes, warming from honey to red. */
export function LevelPips({ n, on }: { n: number; on?: boolean }) {
  const color = n >= 4 ? red : n === 3 ? "color-mix(in oklab, var(--accent) 45%, var(--threat))" : honey;
  return (
    <svg viewBox="0 0 46 10" className="mx-auto h-2.5 w-[46px]" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <path
          key={i}
          d={`m${5.5 + i * 11.5} 1 4 2.25v4.5l-4 2.25-4-2.25v-4.5z`}
          fill={i < n ? color : "none"}
          stroke={i < n ? color : "var(--line-strong)"}
          strokeWidth={1.3}
          strokeLinejoin="round"
          className={on && i < n ? "anim-pop" : ""}
          style={{ transformOrigin: `${5.5 + i * 11.5}px 5.5px`, animationDelay: `${i * 70}ms` }}
        />
      ))}
    </svg>
  );
}

/** Clock choice: an open-ended loop for untimed, else a clock with its share filled. */
export function ClockIcon({ minutes, on }: { minutes: number | null; on?: boolean }) {
  if (!minutes) {
    return (
      <svg viewBox="0 0 24 14" className="h-3.5 w-6" aria-hidden>
        <path d="M12 7c-2.5-4-8-4-8 0s5.5 4 8 0 8-4 8 0-5.5 4-8 0Z" fill="none" stroke={on ? blue : "var(--ink-soft)"} strokeWidth={1.8} strokeLinecap="round" />
      </svg>
    );
  }
  const f = Math.min(1, minutes / 20);
  const a = f * 2 * Math.PI;
  const x = 7 + 5.5 * Math.sin(a);
  const y = 7 - 5.5 * Math.cos(a);
  return (
    <svg viewBox="0 0 14 14" className={`h-3.5 w-3.5 ${on ? "anim-tick" : ""}`} aria-hidden>
      <circle cx="7" cy="7" r="5.8" fill="none" stroke={on ? ink : "var(--ink-soft)"} strokeWidth={1.4} />
      {f >= 0.999 ? (
        <circle cx="7" cy="7" r="5.5" fill={on ? honey : "var(--line-strong)"} />
      ) : (
        <path d={`M7 7V1.5A5.5 5.5 0 ${f > 0.5 ? 1 : 0} 1 ${x.toFixed(2)} ${y.toFixed(2)}Z`} fill={on ? honey : "var(--line-strong)"} />
      )}
    </svg>
  );
}
