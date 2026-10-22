"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "./Icon";
import { MiniTile, PieceTile, sketchHexPath } from "./PieceTile";
import { Tape } from "./Tape";

export function fmtClock(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  return `${m}:${(s % 60).toString().padStart(2, "0")}`;
}

/** A chess-clock face. `ms` is the time left when the clock started running at `since`
 * (epoch ms); while running the face ticks by itself, so the game around it doesn't
 * re-render every fraction of a second. */
export function ClockFace({ ms: base, running, since }: { ms: number; running: boolean; since?: number }) {
  const ticking = running && since !== undefined;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!ticking) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [ticking, since]);
  const ms = ticking ? base - Math.max(0, now - since) : base;
  const low = ms < 20_000;
  return (
    <span
      className={`pencil px-2 py-0.5 font-display text-base font-semibold tabular-nums ${running ? (low ? "text-paper [--bc:var(--danger)] [--fill:var(--danger)]" : "text-paper [--bc:var(--ink)] [--fill:var(--ink)]") : "text-ink-soft [--fill:transparent]"}`}
      aria-label={`Clock ${fmtClock(ms)}`}
    >
      {fmtClock(ms)}
    </span>
  );
}

interface OverProps {
  title: string;
  subtitle?: string;
  detail?: React.ReactNode;
  tone: "win" | "loss" | "draw" | "neutral";
  actions: React.ReactNode;
  onClose: () => void;
}

/** A drawn emblem for the result: a rosette for a win, a surrounded Queen otherwise. */
function Emblem({ tone }: { tone: OverProps["tone"] }) {
  if (tone === "win") {
    return (
      <svg viewBox="-50 -50 100 110" width={84} height={92} className="mx-auto overflow-visible" aria-hidden>
        <path d="M-14 18 -24 56 -11 49 -4 60 4 22M14 18l10 38-13-7-7 11-4-38" fill="var(--threat)" fillOpacity={0.75} stroke="var(--ink)" strokeWidth={2} strokeLinejoin="round" />
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i * Math.PI) / 6;
          return <circle key={i} cx={Math.cos(a) * 26} cy={Math.sin(a) * 26} r={11} fill="var(--accent)" fillOpacity={0.7} stroke="var(--ink)" strokeWidth={1.6} />;
        })}
        <circle r={22} fill="var(--card)" stroke="var(--ink)" strokeWidth={2} />
        <PieceTile bug="Q" color="w" x={0} y={0} size={17} seed={5} />
      </svg>
    );
  }
  if (tone === "draw") {
    return (
      <div className="flex justify-center gap-1" aria-hidden>
        <MiniTile bug="Q" color="w" size={56} seed={3} />
        <MiniTile bug="Q" color="b" size={56} seed={8} />
      </div>
    );
  }
  // The Queen, surrounded: what every Hive game ends with.
  const ring = Array.from({ length: 6 }, (_, i) => {
    const a = ((60 * i - 30) * Math.PI) / 180;
    return [Math.cos(a) * 30, Math.sin(a) * 30] as const;
  });
  return (
    <svg viewBox="-50 -50 100 100" width={92} height={92} className="mx-auto overflow-visible" aria-hidden>
      {ring.map(([x, y], i) => (
        <path key={i} d={sketchHexPath(x, y, 16, i * 5 + 2, 0.06)} fill="var(--card-2)" stroke="var(--ink-soft)" strokeWidth={1.6} strokeDasharray={i % 2 ? undefined : "3 3"} />
      ))}
      <PieceTile bug="Q" color={tone === "loss" ? "w" : "b"} x={0} y={0} size={18} seed={2} />
    </svg>
  );
}

/** The end-of-game card shown over the board. */
export function GameOverCard({ title, subtitle, detail, tone, actions, onClose }: OverProps) {
  return (
    <div className="absolute inset-0 z-10 grid place-items-center overflow-y-auto bg-paper/70 p-3 sm:p-4">
      <div className="rise card w-full max-w-sm !px-4 !pt-5 !pb-4 text-center sm:!p-6">
        <Tape />
        <button className="icon-btn absolute top-2 right-2 !h-10 !w-10 [--bc:transparent] [--fill:transparent]" onClick={onClose} aria-label="Look at the board">
          <Icon name="close" />
        </button>
        <div className="mx-auto w-fit origin-top scale-75 -mb-5 sm:mb-0 sm:scale-100">
          <Emblem tone={tone} />
        </div>
        <div className="font-display mt-1 text-2xl font-semibold sm:mt-2 sm:text-3xl">{title}</div>
        {subtitle && <div className="hand-note mt-1">{subtitle}</div>}
        {detail && <div className="mt-2 text-sm text-muted">{detail}</div>}
        <div className="mt-4 flex flex-wrap justify-center gap-2 sm:mt-5">{actions}</div>
      </div>
    </div>
  );
}

export function NewGameLink() {
  return (
    <Link className="btn-secondary" href="/">
      New game
    </Link>
  );
}
