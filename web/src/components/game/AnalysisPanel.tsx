"use client";

import { useMemo } from "react";
import type {
  MoveAnalysis,
  PositionEval,
  MoveClassification,
  Color,
} from "@/lib/types";

interface Props {
  positionEval: PositionEval | null;
  moveAnalyses: MoveAnalysis[];
  currentMoveIndex: number;
  playerColor: Color;
  analyzePlayer: boolean;
  analyzeCpu: boolean;
  onTogglePlayerAnalysis: () => void;
  onToggleCpuAnalysis: () => void;
}

const CLASSIFICATION_COLORS: Record<MoveClassification, string> = {
  Brilliant: "#26a69a",
  Best: "#66bb6a",
  Good: "#8bc34a",
  Inaccuracy: "#fdd835",
  Mistake: "#ff9800",
  Blunder: "#e53935",
};

const CLASSIFICATION_ICONS: Record<MoveClassification, string> = {
  Brilliant: "!!",
  Best: "!",
  Good: "",
  Inaccuracy: "?!",
  Mistake: "?",
  Blunder: "??",
};

export function AnalysisPanel({
  positionEval,
  moveAnalyses,
  currentMoveIndex,
  playerColor,
  analyzePlayer,
  analyzeCpu,
  onTogglePlayerAnalysis,
  onToggleCpuAnalysis,
}: Props) {
  const analysisEnabled = analyzePlayer || analyzeCpu;

  const currentAnalysis =
    currentMoveIndex >= 0 && currentMoveIndex < moveAnalyses.length
      ? moveAnalyses[currentMoveIndex]
      : null;

  const winBarHeight = positionEval
    ? Math.round(positionEval.winProbability * 100)
    : 50;

  const summary = useMemo(() => {
    if (moveAnalyses.length === 0) return null;
    const counts: Record<MoveClassification, number> = {
      Brilliant: 0,
      Best: 0,
      Good: 0,
      Inaccuracy: 0,
      Mistake: 0,
      Blunder: 0,
    };
    for (const a of moveAnalyses) {
      counts[a.classification]++;
    }
    return counts;
  }, [moveAnalyses]);

  return (
    <div className="flex flex-col gap-2 text-xs">
      {/* Independent toggles */}
      <div className="flex gap-1.5">
        <button
          onClick={onTogglePlayerAnalysis}
          className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-colors ${
            analyzePlayer
              ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
              : "bg-zinc-800 text-zinc-400 border border-zinc-700 hover:bg-zinc-700"
          }`}
        >
          Player {analyzePlayer ? "ON" : "OFF"}
        </button>
        <button
          onClick={onToggleCpuAnalysis}
          className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-colors ${
            analyzeCpu
              ? "bg-blue-500/20 text-blue-400 border border-blue-500/40"
              : "bg-zinc-800 text-zinc-400 border border-zinc-700 hover:bg-zinc-700"
          }`}
        >
          CPU {analyzeCpu ? "ON" : "OFF"}
        </button>
      </div>

      {!analysisEnabled && (
        <p className="text-zinc-500 text-[10px]">
          Enable to see move quality and win probability
        </p>
      )}

      {analysisEnabled && positionEval && (
        <>
          {/* Win probability bar — text uses contrasting colors for readability */}
          <div className="flex items-center gap-2">
            <div className="text-zinc-500 w-8">Win%</div>
            <div className="flex-1 h-5 bg-zinc-700 rounded overflow-hidden relative">
              {/* White portion */}
              <div
                className="absolute inset-y-0 left-0 bg-zinc-100 transition-all duration-300"
                style={{ width: `${playerColor === "White" ? winBarHeight : 100 - winBarHeight}%` }}
              />
              <div className="absolute inset-0 flex items-center justify-between px-1.5 text-[10px] font-mono font-bold">
                {/* Left label: dark text on white bg */}
                <span className="text-zinc-900 drop-shadow-[0_0_2px_rgba(255,255,255,0.5)]">
                  {playerColor === "White"
                    ? `${winBarHeight}%`
                    : `${100 - winBarHeight}%`}
                </span>
                {/* Right label: light text on dark bg */}
                <span className="text-zinc-100 drop-shadow-[0_0_2px_rgba(0,0,0,0.5)]">
                  {playerColor === "White"
                    ? `${100 - winBarHeight}%`
                    : `${winBarHeight}%`}
                </span>
              </div>
            </div>
          </div>

          {/* Position stats */}
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] text-zinc-400">
            <div>
              Your Queen /{" "}
              <span
                className={
                  positionEval.stats.yourQueenNeighbors >= 4
                    ? "text-red-400"
                    : positionEval.stats.yourQueenNeighbors >= 2
                      ? "text-yellow-400"
                      : "text-green-400"
                }
              >
                {positionEval.stats.yourQueenNeighbors}/6
              </span>{" "}
              surrounded
            </div>
            <div>
              Opp Queen /{" "}
              <span
                className={
                  positionEval.stats.opponentQueenNeighbors >= 4
                    ? "text-green-400"
                    : positionEval.stats.opponentQueenNeighbors >= 2
                      ? "text-yellow-400"
                      : "text-zinc-400"
                }
              >
                {positionEval.stats.opponentQueenNeighbors}/6
              </span>{" "}
              surrounded
            </div>
            <div>
              Your moves:{" "}
              <span className="text-zinc-300">
                {positionEval.stats.yourMoves}
              </span>
            </div>
            <div>
              Opp moves:{" "}
              <span className="text-zinc-300">
                {positionEval.stats.opponentMoves}
              </span>
            </div>
            <div>
              Hand pieces:{" "}
              <span className="text-zinc-300">
                {positionEval.stats.yourHandPieces}
              </span>
            </div>
            <div>
              Opp hand:{" "}
              <span className="text-zinc-300">
                {positionEval.stats.opponentHandPieces}
              </span>
            </div>
            {positionEval.stats.beetlesNearOpponentQueen > 0 && (
              <div className="col-span-2 text-green-400">
                Beetles near opp queen:{" "}
                {positionEval.stats.beetlesNearOpponentQueen}
              </div>
            )}
          </div>

          {/* Current move classification */}
          {currentAnalysis && (
            <div
              className="flex items-center gap-2 px-2 py-1 rounded border"
              style={{
                borderColor:
                  CLASSIFICATION_COLORS[currentAnalysis.classification] + "60",
                backgroundColor:
                  CLASSIFICATION_COLORS[currentAnalysis.classification] + "15",
              }}
            >
              <span
                className="font-bold text-sm"
                style={{
                  color:
                    CLASSIFICATION_COLORS[currentAnalysis.classification],
                }}
              >
                {CLASSIFICATION_ICONS[currentAnalysis.classification]}{" "}
                {currentAnalysis.classification}
              </span>
              <span className="text-zinc-500 ml-auto font-mono">
                {currentAnalysis.delta >= 0
                  ? `+${currentAnalysis.delta.toFixed(1)}`
                  : currentAnalysis.delta.toFixed(1)}
              </span>
            </div>
          )}

          {/* Move history analysis summary */}
          {summary && moveAnalyses.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {(
                Object.entries(summary) as [MoveClassification, number][]
              ).map(
                ([cls, count]) =>
                  count > 0 && (
                    <span
                      key={cls}
                      className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                      style={{
                        backgroundColor:
                          CLASSIFICATION_COLORS[cls] + "20",
                        color: CLASSIFICATION_COLORS[cls],
                      }}
                    >
                      {count} {cls}
                    </span>
                  )
              )}
            </div>
          )}

          {/* Evaluation score */}
          <div className="text-zinc-500 font-mono text-[10px]">
            Eval: {positionEval.score > 0 ? "+" : ""}
            {positionEval.score.toFixed(1)}
          </div>
        </>
      )}
    </div>
  );
}
