"use client";

import { useState } from "react";
import { GameSetup } from "@/components/setup/GameSetup";
import { GameView } from "@/components/game/GameView";

export type GameMode = "setup" | "playing";

export interface GameConfig {
  rules: Record<string, unknown>;
  aiConfig: Record<string, unknown> | null; // null = pass-and-play
  playerColor: "White" | "Black";
}

export default function Home() {
  const [mode, setMode] = useState<GameMode>("setup");
  const [gameConfig, setGameConfig] = useState<GameConfig | null>(null);

  const handleStartGame = (config: GameConfig) => {
    setGameConfig(config);
    setMode("playing");
  };

  const handleBackToSetup = () => {
    setMode("setup");
    setGameConfig(null);
  };

  return (
    <main className="min-h-screen">
      {mode === "setup" && <GameSetup onStart={handleStartGame} />}
      {mode === "playing" && gameConfig && (
        <GameView config={gameConfig} onBack={handleBackToSetup} />
      )}
    </main>
  );
}
