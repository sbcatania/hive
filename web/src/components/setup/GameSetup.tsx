"use client";

import { useState, useEffect } from "react";
import { useGameEngine } from "@/hooks/useGameEngine";
import { THEMES, getSavedThemeId, saveThemeId } from "@/themes";
import type { GameConfig } from "@/app/page";
import type {
  RuleConfig,
  AiConfig,
  AiEngine,
  Difficulty,
  GamePreset,
  PieceType,
  UndoMode,
} from "@/lib/types";

const DEFAULT_PIECE_COUNTS: Record<PieceType, number> = {
  Queen: 1,
  Beetle: 2,
  Spider: 2,
  Grasshopper: 3,
  Ant: 3,
  Mosquito: 1,
  Ladybug: 1,
  Pillbug: 1,
};

interface Props {
  onStart: (config: GameConfig) => void;
}

export function GameSetup({ onStart }: Props) {
  const engine = useGameEngine();
  const [presets, setPresets] = useState<GamePreset[]>([]);
  const [selectedPreset, setSelectedPreset] = useState("Standard");
  const [gameMode, setGameMode] = useState<"cpu" | "local">("cpu");
  const [playerColor, setPlayerColor] = useState<"White" | "Black">("White");
  const [themeId, setThemeId] = useState(getSavedThemeId());

  // AI settings
  const [aiEngine, setAiEngine] = useState<AiEngine>("Minimax");
  const [difficulty, setDifficulty] = useState<Difficulty>("Medium");

  // Rule overrides
  const [useMosquito, setUseMosquito] = useState(false);
  const [useLadybug, setUseLadybug] = useState(false);
  const [usePillbug, setUsePillbug] = useState(false);
  const [tournamentOpening, setTournamentOpening] = useState(false);
  const [queenDeadline, setQueenDeadline] = useState<number | null>(4);
  const [undoMode, setUndoMode] = useState<UndoMode>("LastMoveOnly");
  const [timeControl, setTimeControl] = useState<number | null>(null);
  const [customCounts, setCustomCounts] =
    useState<Record<PieceType, number>>(DEFAULT_PIECE_COUNTS);

  useEffect(() => {
    if (engine.ready) {
      try {
        const p = engine.getPresets();
        setPresets(p);
      } catch {
        // Use defaults if presets fail
      }
    }
  }, [engine.ready, engine.getPresets]);

  // Apply preset when selected
  useEffect(() => {
    const preset = presets.find((p) => p.name === selectedPreset);
    if (!preset || selectedPreset === "Custom") return;

    const r = preset.rules;
    setUseMosquito(r.use_mosquito);
    setUseLadybug(r.use_ladybug);
    setUsePillbug(r.use_pillbug);
    setTournamentOpening(r.tournament_opening);
    setQueenDeadline(r.queen_deadline);
    setCustomCounts(r.piece_counts as Record<PieceType, number>);
  }, [selectedPreset, presets]);

  const handleThemeChange = (id: string) => {
    setThemeId(id);
    saveThemeId(id);
  };

  const handleStart = () => {
    const rules: RuleConfig = {
      use_mosquito: useMosquito,
      use_ladybug: useLadybug,
      use_pillbug: usePillbug,
      tournament_opening: tournamentOpening,
      queen_deadline: queenDeadline,
      undo_mode: undoMode,
      time_control: timeControl,
      piece_counts: customCounts,
    };

    const aiConfig: AiConfig | null =
      gameMode === "cpu"
        ? { engine: aiEngine, difficulty, adaptive_history: [] }
        : null;

    onStart({
      rules: rules as unknown as Record<string, unknown>,
      aiConfig: aiConfig as unknown as Record<string, unknown> | null,
      playerColor,
    });
  };

  if (engine.loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-4xl mb-4">Loading engine...</div>
          <div className="animate-pulse text-zinc-400">Initializing WASM</div>
        </div>
      </div>
    );
  }

  if (engine.error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-400 text-center">
          <div className="text-2xl mb-2">Failed to load game engine</div>
          <div className="text-sm">{engine.error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold text-center mb-2">Hive</h1>
      <p className="text-zinc-400 text-center mb-8">
        The buzzing board game of strategic bug placement
      </p>

      {/* Preset Selection */}
      <Section title="Game Preset">
        <div className="grid grid-cols-3 gap-2">
          {(presets.length > 0
            ? presets
            : [
                { name: "Standard", description: "Base game" },
                { name: "All Expansions", description: "All three expansions" },
                { name: "Tournament", description: "Competitive rules" },
                { name: "Custom", description: "Configure yourself" },
              ]
          ).map((p) => (
            <button
              key={p.name}
              onClick={() => setSelectedPreset(p.name)}
              className={`p-3 rounded-lg border text-left transition-colors ${
                selectedPreset === p.name
                  ? "border-amber-500 bg-amber-500/10"
                  : "border-zinc-700 hover:border-zinc-500"
              }`}
            >
              <div className="font-medium text-sm">{p.name}</div>
              <div className="text-xs text-zinc-400">{p.description}</div>
            </button>
          ))}
        </div>
      </Section>

      {/* Game Mode */}
      <Section title="Game Mode">
        <div className="flex gap-3">
          <ToggleButton
            active={gameMode === "cpu"}
            onClick={() => setGameMode("cpu")}
            label="vs Computer"
          />
          <ToggleButton
            active={gameMode === "local"}
            onClick={() => setGameMode("local")}
            label="Pass & Play"
          />
        </div>
      </Section>

      {/* CPU Settings */}
      {gameMode === "cpu" && (
        <Section title="Computer Opponent">
          <div className="space-y-3">
            <div>
              <label className="text-sm text-zinc-400 mb-1 block">
                Play as
              </label>
              <div className="flex gap-2">
                <ToggleButton
                  active={playerColor === "White"}
                  onClick={() => setPlayerColor("White")}
                  label="White (first)"
                />
                <ToggleButton
                  active={playerColor === "Black"}
                  onClick={() => setPlayerColor("Black")}
                  label="Black (second)"
                />
              </div>
            </div>
            <div>
              <label className="text-sm text-zinc-400 mb-1 block">
                AI Engine
              </label>
              <div className="flex gap-2">
                <ToggleButton
                  active={aiEngine === "Minimax"}
                  onClick={() => setAiEngine("Minimax")}
                  label="Minimax"
                />
                <ToggleButton
                  active={aiEngine === "Mcts"}
                  onClick={() => setAiEngine("Mcts")}
                  label="MCTS"
                />
              </div>
            </div>
            <div>
              <label className="text-sm text-zinc-400 mb-1 block">
                Difficulty
              </label>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    "Beginner",
                    "Easy",
                    "Medium",
                    "Hard",
                    "Expert",
                    "Adaptive",
                  ] as Difficulty[]
                ).map((d) => (
                  <ToggleButton
                    key={d}
                    active={difficulty === d}
                    onClick={() => setDifficulty(d)}
                    label={d}
                  />
                ))}
              </div>
            </div>
          </div>
        </Section>
      )}

      {/* Expansions */}
      <Section title="Expansions">
        <div className="flex gap-3">
          <Checkbox
            checked={useMosquito}
            onChange={setUseMosquito}
            label="Mosquito"
          />
          <Checkbox
            checked={useLadybug}
            onChange={setUseLadybug}
            label="Ladybug"
          />
          <Checkbox
            checked={usePillbug}
            onChange={setUsePillbug}
            label="Pillbug"
          />
        </div>
      </Section>

      {/* Rules */}
      <Section title="Rules">
        <div className="space-y-3">
          <Checkbox
            checked={tournamentOpening}
            onChange={setTournamentOpening}
            label="Tournament Opening (no Queen on turn 1)"
          />
          <div>
            <label className="text-sm text-zinc-400 mb-1 block">
              Queen Placement Deadline
            </label>
            <div className="flex gap-2">
              {[3, 4, null].map((v) => (
                <ToggleButton
                  key={String(v)}
                  active={queenDeadline === v}
                  onClick={() => setQueenDeadline(v)}
                  label={v === null ? "None" : `Turn ${v}`}
                />
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm text-zinc-400 mb-1 block">
              Undo Mode
            </label>
            <div className="flex gap-2">
              {(["None", "LastMoveOnly", "FullUndoRedo"] as UndoMode[]).map(
                (m) => (
                  <ToggleButton
                    key={m}
                    active={undoMode === m}
                    onClick={() => setUndoMode(m)}
                    label={
                      m === "LastMoveOnly"
                        ? "Last Move"
                        : m === "FullUndoRedo"
                          ? "Full Undo/Redo"
                          : "Off"
                    }
                  />
                )
              )}
            </div>
          </div>
          <div>
            <label className="text-sm text-zinc-400 mb-1 block">
              Time Control
            </label>
            <div className="flex gap-2">
              {[null, 300, 600, 900].map((v) => (
                <ToggleButton
                  key={String(v)}
                  active={timeControl === v}
                  onClick={() => setTimeControl(v)}
                  label={
                    v === null
                      ? "Untimed"
                      : `${v / 60}min`
                  }
                />
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* Theme */}
      <Section title="Visual Theme">
        <div className="flex gap-3">
          {THEMES.map((t) => (
            <ToggleButton
              key={t.id}
              active={themeId === t.id}
              onClick={() => handleThemeChange(t.id)}
              label={t.name}
            />
          ))}
        </div>
      </Section>

      {/* Start Button */}
      <button
        onClick={handleStart}
        className="w-full mt-8 py-4 bg-amber-500 hover:bg-amber-400 text-black font-bold text-lg rounded-xl transition-colors"
      >
        Start Game
      </button>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      <h2 className="text-lg font-semibold mb-3 text-zinc-200">{title}</h2>
      {children}
    </div>
  );
}

function ToggleButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
        active
          ? "border-amber-500 bg-amber-500/10 text-amber-300"
          : "border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-300"
      }`}
    >
      {label}
    </button>
  );
}

function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 rounded border-zinc-600 accent-amber-500"
      />
      <span className="text-sm">{label}</span>
    </label>
  );
}
