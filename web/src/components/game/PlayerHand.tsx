"use client";

import type { Color, PieceType, GameState } from "@/lib/types";
import { hexPoints } from "@/lib/types";
import type { HiveTheme } from "@/themes/types";

interface Props {
  state: GameState;
  color: Color;
  theme: HiveTheme;
  isActive: boolean;
  selectedPieceType: PieceType | null;
  onSelectPiece: (type: PieceType) => void;
}

const PIECE_ORDER: PieceType[] = [
  "Queen",
  "Beetle",
  "Spider",
  "Grasshopper",
  "Ant",
  "Mosquito",
  "Ladybug",
  "Pillbug",
];

export function PlayerHand({
  state,
  color,
  theme,
  isActive,
  selectedPieceType,
  onSelectPiece,
}: Props) {
  const handIdx = color === "White" ? 0 : 1;
  const hand = state.hands[handIdx];

  // Build a flat list of individual pieces for visual stacking.
  const pieceEntries: { type: PieceType; count: number; total: number }[] = [];
  for (const type of PIECE_ORDER) {
    const count = hand[type] ?? 0;
    if (count > 0) {
      pieceEntries.push({ type, count, total: count });
    }
  }

  return (
    <div
      className={`p-2 md:p-3 rounded-xl border transition-colors ${
        isActive
          ? "border-amber-500/50 bg-amber-500/5"
          : "border-zinc-800 bg-zinc-900/50"
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <div
          className="w-3 h-3 rounded-full shrink-0"
          style={{
            background:
              color === "White"
                ? theme.pieces.whiteColor
                : theme.pieces.blackColor,
            border: `1px solid ${
              color === "White"
                ? theme.pieces.whiteBorder
                : theme.pieces.blackBorder
            }`,
          }}
        />
        <span className="text-sm font-medium">
          {color}
          {isActive && (
            <span className="text-amber-400 ml-1 text-xs">(your turn)</span>
          )}
        </span>
      </div>

      <div className="flex flex-row md:flex-col flex-wrap gap-1.5">
        {pieceEntries.map(({ type, count }) => {
          const isSelected = selectedPieceType === type && isActive;

          return (
            <button
              key={type}
              onClick={() => isActive && onSelectPiece(type)}
              disabled={!isActive}
              className={`relative flex items-center gap-2 px-2 py-1.5 rounded-lg border text-xs transition-colors ${
                isSelected
                  ? "border-blue-400 bg-blue-400/20"
                  : isActive
                    ? "border-zinc-600 hover:border-zinc-400 cursor-pointer"
                    : "border-zinc-800 opacity-60 cursor-default"
              }`}
            >
              {/* Show stacked hex tiles for the count */}
              <div className="relative" style={{ width: 36, height: 36 }}>
                {Array.from({ length: Math.min(count, 3) }).map((_, i) => (
                  <svg
                    key={i}
                    width="32"
                    height="32"
                    viewBox="-14 -14 28 28"
                    className="absolute"
                    style={{
                      left: i * 2,
                      top: i * 2,
                      zIndex: 3 - i,
                      opacity: i === 0 ? 1 : 0.5,
                    }}
                  >
                    <polygon
                      points={hexPoints(0, 0, 12)}
                      fill={
                        color === "White"
                          ? theme.pieces.whiteColor
                          : theme.pieces.blackColor
                      }
                      stroke={
                        color === "White"
                          ? theme.pieces.whiteBorder
                          : theme.pieces.blackBorder
                      }
                      strokeWidth={1}
                    />
                    {i === 0 && (
                      <text
                        x={0}
                        y={4}
                        fontSize={10}
                        fill={theme.pieces.textColor(color)}
                        textAnchor="middle"
                      >
                        {theme.pieces.renderLabel(type)}
                      </text>
                    )}
                  </svg>
                ))}
              </div>
              <div className="flex flex-col items-start leading-tight">
                <span className="text-zinc-200 text-xs font-medium">{type}</span>
                <span className="text-zinc-500 text-[10px]">x{count}</span>
              </div>
            </button>
          );
        })}

        {pieceEntries.length === 0 && (
          <span className="text-xs text-zinc-600 py-1">All placed</span>
        )}
      </div>
    </div>
  );
}
