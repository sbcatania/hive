"use client";

import Link from "next/link";

export function fmtClock(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  return `${m}:${(s % 60).toString().padStart(2, "0")}`;
}

/** A chess-clock face. */
export function ClockFace({ ms, running }: { ms: number; running: boolean }) {
  const low = ms < 20_000;
  return (
    <span
      className={`rounded-lg px-2 py-1 font-mono text-sm tabular-nums transition ${running ? (low ? "bg-danger text-white" : "bg-ink text-paper") : "bg-paper-2 text-ink-soft ring-1 ring-line"}`}
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

/** The end-of-game card shown over the board. */
export function GameOverCard({ title, subtitle, detail, tone, actions, onClose }: OverProps) {
  const emblem = tone === "win" ? "🏆" : tone === "loss" ? "🐞" : tone === "draw" ? "🤝" : "🐝";
  return (
    <div className="absolute inset-0 z-10 grid place-items-center bg-paper/55 p-4 backdrop-blur-[2px]">
      <div className="rise hex-card w-full max-w-sm p-6 text-center">
        <button className="absolute top-3 right-4 text-muted hover:text-ink" onClick={onClose} aria-label="Look at the board">
          ✕
        </button>
        <div className="text-4xl" aria-hidden>
          {emblem}
        </div>
        <div className="font-display mt-2 text-3xl font-semibold">{title}</div>
        {subtitle && <div className="specimen-label mt-1">{subtitle}</div>}
        {detail && <div className="mt-3 text-sm text-ink-soft">{detail}</div>}
        <div className="mt-5 flex flex-wrap justify-center gap-2">{actions}</div>
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
