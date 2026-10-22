"use client";

import { useEffect, useState } from "react";
import { sketchHexPath } from "./PieceTile";

/** Draws an icon's art twice: a faint, slightly shifted pencil pass behind the inked
 * one, the same double line the tiles and outlines have, so every illustration in the
 * app looks drawn by the same hand. (The echo copy keeps only strokes; see .icon-echo.) */
export function Drawn({ children }: { children: React.ReactNode }) {
  return (
    <>
      <g className="icon-echo" aria-hidden>
        {children}
      </g>
      {children}
    </>
  );
}

/** A hand-drawn hexagon (pointy top) for icons, wobbling like the game tiles. */
export function hex(cx: number, cy: number, r: number, seed: number) {
  return sketchHexPath(cx, cy, r, seed, 0.06);
}

/** Counts up every `every` ms (after `offset` ms), for small idle moments such as a
 * blink: use it as a key to replay a one-shot animation. Nothing runs in between. */
export function useTicker(every: number, offset = 0) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let interval: ReturnType<typeof setInterval> | undefined;
    const start = setTimeout(() => {
      setN((x) => x + 1);
      interval = setInterval(() => !document.hidden && setN((x) => x + 1), every);
    }, offset || every);
    return () => {
      clearTimeout(start);
      clearInterval(interval);
    };
  }, [every, offset]);
  return n;
}
