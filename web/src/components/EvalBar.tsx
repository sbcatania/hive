"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { AiResult } from "@/lib/engine-types";

/** Eases a displayed number toward its target with a critically damped spring, so the
 * bar glides between evaluations instead of jumping. */
function useSpring(target: number) {
  const [v, setV] = useState(target);
  const cur = useRef({ x: target, vel: 0 });
  useEffect(() => {
    let raf = 0;
    let prev = performance.now();
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - prev) / 1000);
      prev = now;
      const k = 60;
      const c = 2 * Math.sqrt(k);
      const s = cur.current;
      s.vel += (k * (target - s.x) - c * s.vel) * dt;
      s.x += s.vel * dt;
      if (Math.abs(target - s.x) < 0.0005 && Math.abs(s.vel) < 0.001) {
        s.x = target;
        s.vel = 0;
        setV(target);
        return;
      }
      setV(s.x);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return v;
}

/** White's estimated winning chances: a pencilled bar, Black's share hatched in from the
 * right, with an inked divider where they meet and a tick marking even. */
export function EvalBar({ result, loading }: { result: AiResult | null; loading?: boolean }) {
  // Hold the last evaluation while the next one is computed.
  const lastRef = useRef(0.5);
  if (result) lastRef.current = result.whiteWinProb;
  const target = lastRef.current;
  const p = useSpring(target);
  const pct = Math.round(target * 100);
  const forced = result && Math.abs(result.scoreWhite) >= 999_000;
  const label = !result && lastRef.current === 0.5 ? "—" : !result ? `White ${pct}%, Black ${100 - pct}%` : forced ? (result.scoreWhite > 0 ? "White wins by force" : "Black wins by force") : `White ${pct}%, Black ${100 - pct}%`;
  const uid = useId().replace(/:/g, "");
  const L = 4;
  const R = 196;
  const x = L + p * (R - L);
  return (
    <div className="card p-3">
      <div className="mb-1 flex justify-between gap-2 text-xs">
        <span className="eval-label label mb-0">Evaluation{loading ? " (thinking)" : ""}</span>
        <span className="whitespace-nowrap text-ink-soft">{label}</span>
      </div>
      <svg viewBox="0 0 200 22" className="h-5 w-full" preserveAspectRatio="none" aria-hidden>
        <defs>
          <pattern id={`${uid}-hatch`} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(40)">
            <line x1="0" y1="0" x2="0" y2="5" stroke="var(--ink)" strokeWidth="2.2" />
          </pattern>
          <clipPath id={`${uid}-clip`}>
            <path d={`M${L} 6 Q100 4.5 ${R} 6 L${R} 16 Q100 17.5 ${L} 16Z`} />
          </clipPath>
        </defs>
        <g clipPath={`url(#${uid}-clip)`}>
          <rect x={L} y={0} width={R - L} height={22} fill="var(--card)" />
          <rect x={x} y={0} width={R - x} height={22} fill={`url(#${uid}-hatch)`} opacity={0.85} />
        </g>
        <path d={`M${L} 6 Q100 4.5 ${R} 6 L${R} 16 Q100 17.5 ${L} 16Z`} fill="none" stroke="var(--ink-soft)" strokeWidth={1.4} vectorEffect="non-scaling-stroke" />
        {/* even */}
        <line x1={100} y1={1} x2={100} y2={4.5} stroke="var(--muted)" strokeWidth={1.2} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        <line x1={100} y1={17.5} x2={100} y2={21} stroke="var(--muted)" strokeWidth={1.2} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        {/* where White's share ends */}
        <line x1={x} y1={2.5} x2={x} y2={19.5} stroke="var(--ink)" strokeWidth={2.4} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}
