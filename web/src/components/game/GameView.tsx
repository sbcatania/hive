"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useGameEngine } from "@/hooks/useGameEngine";
import { getTheme, getSavedThemeId, THEMES, saveThemeId } from "@/themes";
import { HexGrid } from "@/components/board/HexGrid";
import { PlayerHand } from "./PlayerHand";
import type { GameConfig } from "@/app/page";
import type {
  GameState,
  GameMove,
  Coord,
  PieceType,
  AiConfig,
  RuleConfig,
  Color,
} from "@/lib/types";

interface Props {
  config: GameConfig;
  onBack: () => void;
}

export function GameView({ config, onBack }: Props) {
  const engine = useGameEngine();
  const [themeId, setThemeId] = useState(getSavedThemeId());
  const theme = getTheme(themeId);

  const [gameState, setGameState] = useState<GameState | null>(null);
  const [legalMoves, setLegalMoves] = useState<GameMove[]>([]);
  const [selectedPiece, setSelectedPiece] = useState<
    | { type: "board"; coord: Coord }
    | { type: "hand"; pieceType: PieceType }
    | null
  >(null);
  const [aiThinking, setAiThinking] = useState(false);
  const [aiPaused, setAiPaused] = useState(false); // Pause AI after undo
  const [message, setMessage] = useState("");

  // Escape key deselects piece.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedPiece(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Initialize game.
  useEffect(() => {
    if (!engine.ready) return;
    try {
      const state = engine.createGame(config.rules as unknown as RuleConfig);
      setGameState(state);
      const moves = engine.getLegalMoves(state);
      setLegalMoves(moves);
    } catch (e) {
      setMessage(`Error: ${e}`);
    }
  }, [engine.ready, engine.createGame, engine.getLegalMoves, config.rules]);

  const isPlayerTurn = useCallback(
    (state: GameState | null): boolean => {
      if (!state || state.status !== "InProgress") return false;
      if (!config.aiConfig) return true; // Pass-and-play: always player turn
      return state.current_player === config.playerColor;
    },
    [config.aiConfig, config.playerColor]
  );

  // AI move — paused after undo so player can undo multiple times.
  useEffect(() => {
    if (!gameState || !engine.ready || !config.aiConfig) return;
    if (isPlayerTurn(gameState)) return;
    if (gameState.status !== "InProgress") return;
    if (aiPaused) return; // Don't auto-move after undo

    setAiThinking(true);
    setMessage("Computer is thinking...");

    // Use setTimeout to let the UI update before blocking on AI.
    const timer = setTimeout(() => {
      try {
        const aiMove = engine.aiPickMove(
          gameState,
          config.aiConfig as unknown as AiConfig
        );
        const newState = engine.applyMove(gameState, aiMove);
        setGameState(newState);
        setLegalMoves(engine.getLegalMoves(newState));
        setSelectedPiece(null);
        setMessage("");
      } catch (e) {
        setMessage(`AI Error: ${e}`);
      } finally {
        setAiThinking(false);
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [gameState, engine, config.aiConfig, isPlayerTurn, aiPaused]);

  // Update message on game end.
  useEffect(() => {
    if (!gameState) return;
    switch (gameState.status) {
      case "WhiteWins":
        setMessage("White wins! The Black Queen is surrounded.");
        break;
      case "BlackWins":
        setMessage("Black wins! The White Queen is surrounded.");
        break;
      case "Draw":
        setMessage("Draw! Both Queens are surrounded.");
        break;
    }
  }, [gameState?.status]);

  const handlePieceClick = useCallback(
    (coord: Coord) => {
      if (!gameState || !isPlayerTurn(gameState) || aiThinking) return;

      const topPiece = getTopPiece(gameState, coord);
      if (!topPiece) return;

      // Can only select own pieces (in pass-and-play, current player's pieces).
      if (topPiece.color !== gameState.current_player) return;

      // If already selected, deselect.
      if (
        selectedPiece?.type === "board" &&
        selectedPiece.coord[0] === coord[0] &&
        selectedPiece.coord[1] === coord[1]
      ) {
        setSelectedPiece(null);
        return;
      }

      setSelectedPiece({ type: "board", coord });
    },
    [gameState, selectedPiece, isPlayerTurn, aiThinking]
  );

  const handleHexClick = useCallback(
    (coord: Coord) => {
      if (!gameState || !engine.ready || !selectedPiece || aiThinking) return;
      if (!isPlayerTurn(gameState)) return;

      // Find the matching legal move.
      let move: GameMove | null = null;

      if (selectedPiece.type === "hand") {
        move =
          legalMoves.find(
            (m) =>
              m !== "Pass" &&
              "Place" in m &&
              m.Place.piece_type === selectedPiece.pieceType &&
              m.Place.to[0] === coord[0] &&
              m.Place.to[1] === coord[1]
          ) || null;
      } else if (selectedPiece.type === "board") {
        move =
          legalMoves.find(
            (m) =>
              m !== "Pass" &&
              "Move" in m &&
              m.Move.from[0] === selectedPiece.coord[0] &&
              m.Move.from[1] === selectedPiece.coord[1] &&
              m.Move.to[0] === coord[0] &&
              m.Move.to[1] === coord[1]
          ) || null;

        // Check pillbug throws too.
        if (!move) {
          move =
            legalMoves.find(
              (m) =>
                m !== "Pass" &&
                "PillbugThrow" in m &&
                m.PillbugThrow.to[0] === coord[0] &&
                m.PillbugThrow.to[1] === coord[1]
            ) || null;
        }
      }

      if (!move) return;

      try {
        const newState = engine.applyMove(gameState, move);
        setGameState(newState);
        setLegalMoves(engine.getLegalMoves(newState));
        setSelectedPiece(null);
        setMessage("");
        setAiPaused(false); // Player made a move, AI can respond
      } catch (e) {
        setMessage(`Error: ${e}`);
      }
    },
    [gameState, engine, selectedPiece, legalMoves, isPlayerTurn, aiThinking]
  );

  const handleHandSelect = useCallback(
    (pieceType: PieceType) => {
      if (
        selectedPiece?.type === "hand" &&
        selectedPiece.pieceType === pieceType
      ) {
        setSelectedPiece(null);
      } else {
        setSelectedPiece({ type: "hand", pieceType });
      }
    },
    [selectedPiece]
  );

  const handleUndo = useCallback(() => {
    if (!gameState || !engine.ready) return;
    try {
      const newState = engine.undoMove(gameState);
      setGameState(newState);
      setLegalMoves(engine.getLegalMoves(newState));
      setSelectedPiece(null);
      setAiPaused(true); // Don't let AI auto-move after undo
    } catch (e) {
      setMessage(`${e}`);
    }
  }, [gameState, engine]);

  const handleRedo = useCallback(() => {
    if (!gameState || !engine.ready) return;
    try {
      const newState = engine.redoMove(gameState);
      setGameState(newState);
      setLegalMoves(engine.getLegalMoves(newState));
      setSelectedPiece(null);
    } catch (e) {
      setMessage(`${e}`);
    }
  }, [gameState, engine]);

  const handlePass = useCallback(() => {
    if (!gameState || !engine.ready) return;
    const passMove = legalMoves.find((m) => m === "Pass");
    if (!passMove) {
      setMessage("You have legal moves — cannot pass.");
      return;
    }
    try {
      const newState = engine.applyMove(gameState, "Pass");
      setGameState(newState);
      setLegalMoves(engine.getLegalMoves(newState));
      setSelectedPiece(null);
      setAiPaused(false); // Player passed, AI can respond
    } catch (e) {
      setMessage(`${e}`);
    }
  }, [gameState, engine, legalMoves]);

  const lastMoveCoords = useMemo((): Coord[] => {
    if (!gameState?.last_move) return [];
    const m = gameState.last_move;
    if (m === "Pass") return [];
    if ("Place" in m) return [m.Place.to];
    if ("Move" in m) return [m.Move.from, m.Move.to];
    if ("PillbugThrow" in m) return [m.PillbugThrow.target, m.PillbugThrow.to];
    return [];
  }, [gameState?.last_move]);

  const canUndo =
    gameState?.rules.undo_mode !== "None" &&
    (gameState?.history.length ?? 0) > 0;
  const canRedo =
    gameState?.rules.undo_mode === "FullUndoRedo" &&
    (gameState?.redo_stack.length ?? 0) > 0;
  const canPass = legalMoves.some((m) => m === "Pass");

  if (!gameState) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-zinc-400">Starting game...</div>
      </div>
    );
  }

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
            Turn {Math.floor(gameState.turn / 2) + 1}
          </span>
          <span className="text-xs text-zinc-600">|</span>
          <span
            className={`text-xs sm:text-sm font-medium ${
              gameState.current_player === "White"
                ? "text-zinc-200"
                : "text-zinc-400"
            }`}
          >
            {gameState.current_player}&apos;s turn
          </span>
        </div>
        <div className="flex items-center gap-1">
          {/* Controls inline on small screens */}
          <div className="flex items-center gap-1 mr-2 md:mr-0">
            {canUndo && (
              <button
                onClick={handleUndo}
                className="px-2 py-1 text-xs border border-zinc-700 rounded hover:border-zinc-500 text-zinc-400"
              >
                Undo
              </button>
            )}
            {canRedo && (
              <button
                onClick={handleRedo}
                className="px-2 py-1 text-xs border border-zinc-700 rounded hover:border-zinc-500 text-zinc-400"
              >
                Redo
              </button>
            )}
            {canPass && isPlayerTurn(gameState) && (
              <button
                onClick={handlePass}
                className="px-2 py-1 text-xs border border-amber-700 rounded hover:border-amber-500 text-amber-400"
              >
                Pass
              </button>
            )}
            {aiPaused && !isPlayerTurn(gameState) && config.aiConfig && (
              <button
                onClick={() => setAiPaused(false)}
                className="px-2 py-1 text-xs border border-green-700 rounded hover:border-green-500 text-green-400"
              >
                Let AI Play
              </button>
            )}
          </div>
          {THEMES.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setThemeId(t.id);
                saveThemeId(t.id);
              }}
              className={`w-5 h-5 rounded-full border ${
                themeId === t.id
                  ? "border-amber-400"
                  : "border-zinc-700"
              }`}
              style={{ background: t.board.background }}
              title={t.name}
            />
          ))}
        </div>
      </div>

      {/* Main area: column on mobile, row on desktop */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0">
        {/* Black hand: top on mobile, left sidebar on desktop */}
        <div className="shrink-0 p-2 md:p-3 border-b md:border-b-0 md:border-r border-zinc-800 md:w-72 overflow-x-auto md:overflow-x-visible md:overflow-y-auto">
          <PlayerHand
            state={gameState}
            color="Black"
            theme={theme}
            isActive={
              gameState.current_player === "Black" &&
              isPlayerTurn(gameState) &&
              !aiThinking
            }
            selectedPieceType={
              selectedPiece?.type === "hand" &&
              gameState.current_player === "Black"
                ? selectedPiece.pieceType
                : null
            }
            onSelectPiece={handleHandSelect}
          />
        </div>

        {/* Center: Board */}
        <div className="flex-1 relative min-h-0 min-w-0">
          <HexGrid
            state={gameState}
            theme={theme}
            legalMoves={legalMoves}
            selectedPiece={selectedPiece}
            lastMoveCoords={lastMoveCoords}
            onHexClick={handleHexClick}
            onPieceClick={handlePieceClick}
            onDeselect={() => setSelectedPiece(null)}
          />

          {/* Message overlay */}
          {message && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-zinc-900/90 border border-zinc-700 rounded-lg text-xs sm:text-sm max-w-[90%] text-center">
              {message}
            </div>
          )}

          {/* AI thinking overlay */}
          {aiThinking && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-zinc-900/90 border border-amber-700 rounded-lg text-xs sm:text-sm text-amber-400 animate-pulse">
              Computer thinking...
            </div>
          )}

          {/* Game over overlay */}
          {gameState.status !== "InProgress" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
              <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 sm:p-8 text-center mx-4">
                <div className="text-2xl sm:text-3xl font-bold mb-2">
                  {gameState.status === "Draw"
                    ? "Draw!"
                    : gameState.status === "WhiteWins"
                      ? "White Wins!"
                      : "Black Wins!"}
                </div>
                <p className="text-zinc-400 mb-6 text-sm">{message}</p>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={onBack}
                    className="px-6 py-2 bg-amber-500 hover:bg-amber-400 text-black font-medium rounded-lg"
                  >
                    New Game
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* White hand: bottom on mobile, right sidebar on desktop */}
        <div className="shrink-0 p-2 md:p-3 border-t md:border-t-0 md:border-l border-zinc-800 md:w-72 overflow-x-auto md:overflow-x-visible md:overflow-y-auto">
          <PlayerHand
            state={gameState}
            color="White"
            theme={theme}
            isActive={
              gameState.current_player === "White" &&
              isPlayerTurn(gameState) &&
              !aiThinking
            }
            selectedPieceType={
              selectedPiece?.type === "hand" &&
              gameState.current_player === "White"
                ? selectedPiece.pieceType
                : null
            }
            onSelectPiece={handleHandSelect}
          />
        </div>
      </div>
    </div>
  );
}

function getTopPiece(
  state: GameState,
  coord: Coord
): { piece_type: PieceType; color: Color } | null {
  const key = `${coord[0]},${coord[1]}`;
  const stack = state.board.grid[key];
  if (!stack || stack.length === 0) return null;
  return stack[stack.length - 1];
}
