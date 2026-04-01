"use client";

import { useState } from "react";
import { GameSetup } from "@/components/setup/GameSetup";
import { GameView } from "@/components/game/GameView";
import { ReplayView } from "@/components/game/ReplayView";
import type { GameRecord } from "@/lib/gameRecorder";

export type GameMode = "setup" | "playing" | "replay";

export interface GameConfig {
  rules: Record<string, unknown>;
  aiConfig: Record<string, unknown> | null; // null = pass-and-play
  playerColor: "White" | "Black";
}

export default function Home() {
  const [mode, setMode] = useState<GameMode>("setup");
  const [gameConfig, setGameConfig] = useState<GameConfig | null>(null);
  const [replayRecord, setReplayRecord] = useState<GameRecord | null>(null);

  const handleStartGame = (config: GameConfig) => {
    setGameConfig(config);
    setMode("playing");
  };

  const handleReplay = (record: GameRecord) => {
    setReplayRecord(record);
    setMode("replay");
  };

  const handleBackToSetup = () => {
    setMode("setup");
    setGameConfig(null);
    setReplayRecord(null);
  };

  return (
    <main className="min-h-screen">
      {mode === "setup" && (
        <GameSetup onStart={handleStartGame} onReplay={handleReplay} />
      )}
      {mode === "playing" && gameConfig && (
        <GameView config={gameConfig} onBack={handleBackToSetup} />
      )}
      {mode === "replay" && replayRecord && (
        <ReplayView record={replayRecord} onBack={handleBackToSetup} onReplay={handleReplay} />
      )}
    </main>
  );
}
