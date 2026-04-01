"use client";

import { useState, useEffect, useRef } from "react";
import type { Color } from "@/lib/types";

interface Props {
  /** Time remaining in seconds (from engine state), or null if no time control. */
  timeRemaining: number | null;
  color: Color;
  /** Whether this player's clock is currently ticking. */
  isActive: boolean;
  /** Whether the game is over (pauses all timers). */
  gameOver: boolean;
}

function formatTime(seconds: number): string {
  if (seconds <= 0) return "00:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function GameTimer({ timeRemaining, color, isActive, gameOver }: Props) {
  if (timeRemaining == null) return null;

  const [displayTime, setDisplayTime] = useState(timeRemaining);
  const lastSyncRef = useRef(timeRemaining);

  // Sync display time when the engine value changes (after a move).
  useEffect(() => {
    if (timeRemaining !== lastSyncRef.current) {
      setDisplayTime(timeRemaining);
      lastSyncRef.current = timeRemaining;
    }
  }, [timeRemaining]);

  // Countdown interval for the active player.
  useEffect(() => {
    if (!isActive || gameOver || displayTime <= 0) return;

    const interval = setInterval(() => {
      setDisplayTime((prev) => {
        const next = prev - 1;
        return next < 0 ? 0 : next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, gameOver, displayTime]);

  const isExpired = displayTime <= 0;
  const isLow = displayTime <= 30 && displayTime > 0;

  return (
    <div
      className={`flex items-center justify-between px-3 py-2 rounded-lg border text-sm font-mono transition-all mb-2 ${
        isExpired
          ? "border-red-500 bg-red-500/10 text-red-400"
          : isActive && !gameOver
            ? isLow
              ? "border-red-400/60 bg-red-400/5 text-red-300 shadow-[0_0_8px_rgba(248,113,113,0.3)]"
              : "border-amber-400/60 bg-amber-400/5 text-amber-300 shadow-[0_0_8px_rgba(251,191,36,0.2)]"
            : "border-zinc-700 bg-zinc-900/50 text-zinc-400"
      }`}
    >
      <span className="text-xs font-sans font-medium">
        {color} Clock
      </span>
      {isExpired ? (
        <span className="text-red-400 font-bold text-xs font-sans">
          Time&apos;s up!
        </span>
      ) : (
        <span className={`text-lg tabular-nums ${isActive && !gameOver ? "font-bold" : ""}`}>
          {formatTime(displayTime)}
        </span>
      )}
    </div>
  );
}
