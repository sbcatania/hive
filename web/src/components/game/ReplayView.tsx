"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useGameEngine } from "@/hooks/useGameEngine";
import { getTheme, getSavedThemeId, THEMES, saveThemeId } from "@/themes";
import { HexGrid } from "@/components/board/HexGrid";
import { AnalysisPanel } from "./AnalysisPanel";
import {
  exportRecord,
  importRecord,
  type GameRecord,
} from "@/lib/gameRecorder";
import type { GameState, GameMove, Coord, MoveAnalysis, PositionEval } from "@/lib/types";

interface Props {
  record: GameRecord;
  onBack: () => void;
  onReplay?: (record: GameRecord) => void;
}

export function ReplayView({ record, onBack, onReplay }: Props) {
  const engine = useGameEngine();
  const [themeId, setThemeId] = useState(getSavedThemeId());
  const theme = getTheme(themeId);

  // All game states from initial to final.
  const [states, setStates] = useState<GameState[]>([]);
  const [moveIndex, setMoveIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1000);
  const playTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Analysis state — shown by default for both sides.
  const [analyzeWhite, setAnalyzeWhite] = useState(true);
  const [analyzeBlack, setAnalyzeBlack] = useState(true);
  const [moveAnalyses, setMoveAnalyses] = useState<(MoveAnalysis | null)[]>([]);
  const [positionEval, setPositionEval] = useState<PositionEval | null>(null);

  // Build all states by replaying moves.
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

      // Pre-compute analyses for all moves.
      const analyses: (MoveAnalysis | null)[] = [];
      for (let i = 0; i < record.moves.length; i++) {
        try {
          const analysis = engine.analyzeMove(allStates[i], record.moves[i]);
          analyses.push(analysis);
        } catch {
          analyses.push(null);
        }
      }
      setMoveAnalyses(analyses);
    } catch (e) {
      console.error("Failed to replay game:", e);
    }
  }, [engine.ready, engine.createGame, engine.applyMove, engine.analyzeMove, record]);

  const currentState = states[moveIndex] ?? null;
  const totalMoves = record.moves.length;

  // Update position eval when stepping through.
  useEffect(() => {
    if (!currentState || !engine.ready) {
      setPositionEval(null);
      return;
    }
    if (!analyzeWhite && !analyzeBlack) {
      setPositionEval(null);
      return;
    }
    try {
      const evaluation = engine.evaluatePosition(currentState, "White");
      setPositionEval(evaluation);
    } catch {
      setPositionEval(null);
    }
  }, [currentState, engine.ready, engine.evaluatePosition, analyzeWhite, analyzeBlack]);

  // Filter analyses based on toggles.
  const filteredAnalyses = useMemo(() => {
    return moveAnalyses.filter((a, i) => {
      if (!a) return false;
      const isWhiteTurn = i % 2 === 0;
      return isWhiteTurn ? analyzeWhite : analyzeBlack;
    }).filter((a): a is MoveAnalysis => a !== null);
  }, [moveAnalyses, analyzeWhite, analyzeBlack]);

  // Current move's analysis.
  const currentAnalysisIndex = moveIndex > 0 ? moveIndex - 1 : -1;
  const currentMoveIsWhite = currentAnalysisIndex >= 0 ? currentAnalysisIndex % 2 === 0 : false;
  const showCurrentAnalysis =
    currentAnalysisIndex >= 0 &&
    (currentMoveIsWhite ? analyzeWhite : analyzeBlack);

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
      setMoveIndex(0);
      setPlaying(true);
    } else {
      setPlaying((prev) => !prev);
    }
  }, [moveIndex, totalMoves]);

  const handleImport = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !onReplay) return;
      try {
        const imported = await importRecord(file);
        onReplay(imported);
      } catch (err) {
        alert(`Failed to import: ${err}`);
      }
      // Reset input so same file can be re-imported
      e.target.value = "";
    },
    [onReplay]
  );

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

  // Last move coords for highlighting.
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
            {record.name}: {record.metadata.whitePlayer} vs {record.metadata.blackPlayer}
          </span>
          <span className="text-xs text-zinc-600">|</span>
          <span className="text-xs sm:text-sm text-amber-400">{resultLabel}</span>
        </div>
        <div className="flex items-center gap-1">
          {/* Export / Import */}
          <button
            onClick={() => exportRecord(record)}
            className="px-2 py-0.5 rounded border text-[10px] sm:text-xs font-medium border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Export
          </button>
          {onReplay && (
            <label className="px-2 py-0.5 rounded border text-[10px] sm:text-xs font-medium border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer">
              Import
              <input
                type="file"
                accept=".hive,.json"
                className="hidden"
                onChange={handleImport}
              />
            </label>
          )}
          <span className="text-zinc-700 mx-0.5">|</span>
          {THEMES.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setThemeId(t.id);
                saveThemeId(t.id);
              }}
              className={`px-2 py-0.5 rounded border text-[10px] sm:text-xs font-medium transition-colors ${
                themeId === t.id
                  ? "border-amber-400 text-amber-300"
                  : "border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300"
              }`}
              style={{ background: t.board.background }}
            >
              {t.name}
            </button>
          ))}
        </div>
      </div>

      {/* Main area with analysis sidebar */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0">
        {/* Analysis sidebar */}
        <div className="hidden md:block shrink-0 p-3 border-r border-zinc-800 w-64 overflow-y-auto">
          <AnalysisPanel
            positionEval={positionEval}
            moveAnalyses={filteredAnalyses}
            currentMoveIndex={showCurrentAnalysis ? filteredAnalyses.length - 1 : -1}
            playerColor="White"
            analyzePlayer={analyzeWhite}
            analyzeCpu={analyzeBlack}
            onTogglePlayerAnalysis={() => setAnalyzeWhite((v) => !v)}
            onToggleCpuAnalysis={() => setAnalyzeBlack((v) => !v)}
          />

          {/* Move-by-move analysis list */}
          {(analyzeWhite || analyzeBlack) && moveAnalyses.length > 0 && (
            <div className="mt-3 border-t border-zinc-800 pt-2">
              <div className="text-[10px] text-zinc-500 mb-1 font-medium">Move Analysis</div>
              <div className="max-h-48 overflow-y-auto space-y-0.5">
                {moveAnalyses.map((a, i) => {
                  if (!a) return null;
                  const isWhiteTurn = i % 2 === 0;
                  if (isWhiteTurn && !analyzeWhite) return null;
                  if (!isWhiteTurn && !analyzeBlack) return null;
                  const isCurrent = i === currentAnalysisIndex;
                  return (
                    <button
                      key={i}
                      onClick={() => {
                        setPlaying(false);
                        setMoveIndex(i + 1);
                      }}
                      className={`w-full flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[10px] text-left transition-colors ${
                        isCurrent
                          ? "bg-zinc-700/50 text-zinc-200"
                          : "text-zinc-400 hover:bg-zinc-800"
                      }`}
                    >
                      <span className="text-zinc-600 w-5 text-right">{i + 1}.</span>
                      <span className={isWhiteTurn ? "text-zinc-300" : "text-zinc-500"}>
                        {isWhiteTurn ? "W" : "B"}
                      </span>
                      <span
                        className="font-medium"
                        style={{
                          color: classificationColor(a.classification),
                        }}
                      >
                        {a.classification}
                      </span>
                      <span className="ml-auto font-mono text-zinc-600">
                        {a.delta >= 0 ? `+${a.delta.toFixed(1)}` : a.delta.toFixed(1)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
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
            {/* Inline analysis badge for current move */}
            {showCurrentAnalysis && currentAnalysisIndex >= 0 && moveAnalyses[currentAnalysisIndex] && (
              <span
                className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-medium"
                style={{
                  backgroundColor: classificationColor(moveAnalyses[currentAnalysisIndex]!.classification) + "20",
                  color: classificationColor(moveAnalyses[currentAnalysisIndex]!.classification),
                }}
              >
                {moveAnalyses[currentAnalysisIndex]!.classification}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Replay controls bar */}
      <div className="shrink-0 border-t border-zinc-800 px-3 sm:px-4 py-3">
        <div className="flex items-center justify-center gap-2 sm:gap-3">
          <button
            onClick={goToStart}
            disabled={moveIndex === 0}
            className="px-2 py-1 text-sm border border-zinc-700 rounded hover:border-zinc-500 text-zinc-400 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Go to start (Home)"
          >
            |&lt;
          </button>
          <button
            onClick={goBack}
            disabled={moveIndex === 0}
            className="px-2 py-1 text-sm border border-zinc-700 rounded hover:border-zinc-500 text-zinc-400 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Step back (Left arrow)"
          >
            &lt;
          </button>
          <button
            onClick={togglePlay}
            className="px-3 py-1 text-sm border border-amber-700 rounded hover:border-amber-500 text-amber-400 min-w-[60px]"
            title="Play/Pause (Space)"
          >
            {playing ? "Pause" : "Play"}
          </button>
          <button
            onClick={goForward}
            disabled={moveIndex >= totalMoves}
            className="px-2 py-1 text-sm border border-zinc-700 rounded hover:border-zinc-500 text-zinc-400 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Step forward (Right arrow)"
          >
            &gt;
          </button>
          <button
            onClick={goToEnd}
            disabled={moveIndex >= totalMoves}
            className="px-2 py-1 text-sm border border-zinc-700 rounded hover:border-zinc-500 text-zinc-400 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Go to end (End)"
          >
            &gt;|
          </button>
        </div>

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

const CLASSIFICATION_COLORS: Record<string, string> = {
  Brilliant: "#26a69a",
  Best: "#66bb6a",
  Good: "#8bc34a",
  Inaccuracy: "#fdd835",
  Mistake: "#ff9800",
  Blunder: "#e53935",
};

function classificationColor(cls: string): string {
  return CLASSIFICATION_COLORS[cls] || "#a1a1aa";
}
