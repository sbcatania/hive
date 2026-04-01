"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useGameEngine } from "@/hooks/useGameEngine";
import { getTheme, getSavedThemeId, THEMES, saveThemeId } from "@/themes";
import { HexGrid } from "@/components/board/HexGrid";
import type { GameRecord } from "@/lib/gameRecorder";
import type { GameState, GameMove, Coord } from "@/lib/types";

interface Props {
  record: GameRecord;
  onBack: () => void;
}

export function ReplayView({ record, onBack }: Props) {
  const engine = useGameEngine();
  const [themeId, setThemeId] = useState(getSavedThemeId());
  const theme = getTheme(themeId);

  // All game states from initial to final, computed once the engine is ready.
  const [states, setStates] = useState<GameState[]>([]);
  const [moveIndex, setMoveIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1000); // ms per move
  const playTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Build all states by replaying moves through the engine.
  useEffect(() => {
    if (!engine.ready) return;
    try {
      const initial = engine.createGame(record.metadata.rules);
      const allStates: GameState[] = [initial];
      let current = initial;
      for (const move of record.moves) {
        current = engine.applyMove(current, move);
        allStates.push(current);
      }
      setStates(allStates);
      setMoveIndex(0);
    } catch (e) {
      console.error("Failed to replay game:", e);
    }
  }, [engine.ready, engine.createGame, engine.applyMove, record]);

  const currentState = states[moveIndex] ?? null;
  const totalMoves = record.moves.length;

  // Auto-play timer.
  useEffect(() => {
    if (playing && moveIndex < totalMoves) {
      playTimerRef.current = setInterval(() => {
        setMoveIndex((prev) => {
          if (prev >= totalMoves) {
            setPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, speed);
    } else {
      setPlaying(false);
    }
    return () => {
      if (playTimerRef.current) clearInterval(playTimerRef.current);
    };
  }, [playing, speed, totalMoves, moveIndex]);

  const goToStart = useCallback(() => {
    setPlaying(false);
    setMoveIndex(0);
  }, []);

  const goBack = useCallback(() => {
    setPlaying(false);
    setMoveIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const goForward = useCallback(() => {
    setPlaying(false);
    setMoveIndex((prev) => Math.min(totalMoves, prev + 1));
  }, [totalMoves]);

  const goToEnd = useCallback(() => {
    setPlaying(false);
    setMoveIndex(totalMoves);
  }, [totalMoves]);

  const togglePlay = useCallback(() => {
    if (moveIndex >= totalMoves) {
      // If at end, restart from beginning.
      setMoveIndex(0);
      setPlaying(true);
    } else {
      setPlaying((prev) => !prev);
    }
  }, [moveIndex, totalMoves]);

  // Keyboard shortcuts.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowLeft":
          goBack();
          break;
        case "ArrowRight":
          goForward();
          break;
        case "Home":
          goToStart();
          break;
        case "End":
          goToEnd();
          break;
        case " ":
          e.preventDefault();
          togglePlay();
          break;
        case "Escape":
          onBack();
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goBack, goForward, goToStart, goToEnd, togglePlay, onBack]);

  // Compute last move coords for highlighting.
  const lastMoveCoords = useMemo((): Coord[] => {
    if (moveIndex === 0) return [];
    const move = record.moves[moveIndex - 1];
    if (!move || move === "Pass") return [];
    if ("Place" in move) return [move.Place.to];
    if ("Move" in move) return [move.Move.from, move.Move.to];
    if ("PillbugThrow" in move) return [move.PillbugThrow.target, move.PillbugThrow.to];
    return [];
  }, [moveIndex, record.moves]);

  if (!currentState) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-zinc-400">Loading replay...</div>
      </div>
    );
  }

  const resultLabel =
    record.metadata.result === "InProgress"
      ? "In Progress"
      : record.metadata.result === "WhiteWins"
        ? "White Wins"
        : record.metadata.result === "BlackWins"
          ? "Black Wins"
          : "Draw";

  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2 border-b border-zinc-800 shrink-0">
        <button
          onClick={onBack}
          className="text-xs sm:text-sm text-zinc-400 hover:text-zinc-200"
        >
          Back
        </button>
        <div className="flex items-center gap-2">
          <span className="text-xs sm:text-sm text-zinc-400">
            Replay: {record.metadata.whitePlayer} vs {record.metadata.blackPlayer}
          </span>
          <span className="text-xs text-zinc-600">|</span>
          <span className="text-xs sm:text-sm text-amber-400">{resultLabel}</span>
        </div>
        <div className="flex items-center gap-1">
          {THEMES.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setThemeId(t.id);
                saveThemeId(t.id);
              }}
              className={`w-5 h-5 rounded-full border ${
                themeId === t.id ? "border-amber-400" : "border-zinc-700"
              }`}
              style={{ background: t.board.background }}
              title={t.name}
            />
          ))}
        </div>
      </div>

      {/* Board area */}
      <div className="flex-1 relative min-h-0 min-w-0">
        <HexGrid
          state={currentState}
          theme={theme}
          legalMoves={[]}
          selectedPiece={null}
          lastMoveCoords={lastMoveCoords}
          onHexClick={() => {}}
          onPieceClick={() => {}}
        />

        {/* Turn info overlay */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-zinc-900/90 border border-zinc-700 rounded-lg text-xs sm:text-sm text-zinc-300">
          Turn {Math.floor(currentState.turn / 2) + 1} &mdash;{" "}
          <span
            className={
              currentState.current_player === "White"
                ? "text-zinc-200"
                : "text-zinc-400"
            }
          >
            {currentState.current_player}&apos;s turn
          </span>
        </div>
      </div>

      {/* Replay controls bar */}
      <div className="shrink-0 border-t border-zinc-800 px-3 sm:px-4 py-3">
        <div className="flex items-center justify-center gap-2 sm:gap-3">
          {/* Go to start */}
          <button
            onClick={goToStart}
            disabled={moveIndex === 0}
            className="px-2 py-1 text-sm border border-zinc-700 rounded hover:border-zinc-500 text-zinc-400 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Go to start (Home)"
          >
            |&lt;
          </button>

          {/* Step back */}
          <button
            onClick={goBack}
            disabled={moveIndex === 0}
            className="px-2 py-1 text-sm border border-zinc-700 rounded hover:border-zinc-500 text-zinc-400 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Step back (Left arrow)"
          >
            &lt;
          </button>

          {/* Play/Pause */}
          <button
            onClick={togglePlay}
            className="px-3 py-1 text-sm border border-amber-700 rounded hover:border-amber-500 text-amber-400 min-w-[60px]"
            title="Play/Pause (Space)"
          >
            {playing ? "Pause" : "Play"}
          </button>

          {/* Step forward */}
          <button
            onClick={goForward}
            disabled={moveIndex >= totalMoves}
            className="px-2 py-1 text-sm border border-zinc-700 rounded hover:border-zinc-500 text-zinc-400 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Step forward (Right arrow)"
          >
            &gt;
          </button>

          {/* Go to end */}
          <button
            onClick={goToEnd}
            disabled={moveIndex >= totalMoves}
            className="px-2 py-1 text-sm border border-zinc-700 rounded hover:border-zinc-500 text-zinc-400 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Go to end (End)"
          >
            &gt;|
          </button>
        </div>

        {/* Progress and speed controls */}
        <div className="flex items-center justify-center gap-4 mt-2">
          <span className="text-xs text-zinc-500">
            Move {moveIndex} / {totalMoves}
          </span>

          <div className="flex items-center gap-2">
            <label className="text-xs text-zinc-500">Speed:</label>
            <input
              type="range"
              min={200}
              max={3000}
              step={100}
              value={3200 - speed}
              onChange={(e) => setSpeed(3200 - Number(e.target.value))}
              className="w-24 accent-amber-500"
            />
            <span className="text-xs text-zinc-500 w-10">
              {(speed / 1000).toFixed(1)}s
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
