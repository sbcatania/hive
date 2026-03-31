"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { GameState, GameMove, RuleConfig, AiConfig } from "@/lib/types";

interface EngineAPI {
  create_game: (rules: string) => string;
  get_legal_moves: (state: string) => string;
  apply_move: (state: string, move: string) => string;
  undo_move: (state: string) => string;
  redo_move: (state: string) => string;
  ai_pick_move: (state: string, config: string) => string;
  get_presets: () => string;
}

export function useGameEngine() {
  const [engine, setEngine] = useState<EngineAPI | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    (async () => {
      try {
        // Dynamic import of the wasm-pack generated JS glue.
        // The .wasm file is loaded via fetch from /wasm/ in public.
        const wasm = await import("../../public/wasm/hive_engine.js");
        await wasm.default("/wasm/hive_engine_bg.wasm");
        setEngine(wasm as unknown as EngineAPI);
      } catch (e) {
        setError(`Failed to load WASM engine: ${e}`);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const createGame = useCallback(
    (rules: RuleConfig): GameState => {
      if (!engine) throw new Error("Engine not loaded");
      const result = engine.create_game(JSON.stringify(rules));
      return JSON.parse(result);
    },
    [engine]
  );

  const getLegalMoves = useCallback(
    (state: GameState): GameMove[] => {
      if (!engine) throw new Error("Engine not loaded");
      const result = engine.get_legal_moves(JSON.stringify(state));
      return JSON.parse(result);
    },
    [engine]
  );

  const applyMove = useCallback(
    (state: GameState, move: GameMove): GameState => {
      if (!engine) throw new Error("Engine not loaded");
      const result = engine.apply_move(
        JSON.stringify(state),
        JSON.stringify(move)
      );
      return JSON.parse(result);
    },
    [engine]
  );

  const undoMove = useCallback(
    (state: GameState): GameState => {
      if (!engine) throw new Error("Engine not loaded");
      const result = engine.undo_move(JSON.stringify(state));
      return JSON.parse(result);
    },
    [engine]
  );

  const redoMove = useCallback(
    (state: GameState): GameState => {
      if (!engine) throw new Error("Engine not loaded");
      const result = engine.redo_move(JSON.stringify(state));
      return JSON.parse(result);
    },
    [engine]
  );

  const aiPickMove = useCallback(
    (state: GameState, config: AiConfig): GameMove => {
      if (!engine) throw new Error("Engine not loaded");
      const result = engine.ai_pick_move(
        JSON.stringify(state),
        JSON.stringify(config)
      );
      return JSON.parse(result);
    },
    [engine]
  );

  const getPresets = useCallback(() => {
    if (!engine) throw new Error("Engine not loaded");
    return JSON.parse(engine.get_presets());
  }, [engine]);

  return {
    loading,
    error,
    ready: !!engine,
    createGame,
    getLegalMoves,
    applyMove,
    undoMove,
    redoMove,
    aiPickMove,
    getPresets,
  };
}
