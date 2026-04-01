"use client";

import { useMemo } from "react";
import type { GameState, GameMove, Coord, Piece, PieceType } from "@/lib/types";
import {
  axialToPixel,
  hexPoints,
  parseCoordKey,
  pieceAbbrev,
} from "@/lib/types";
import type { HiveTheme } from "@/themes/types";

const HEX_SIZE = 36;

interface Props {
  state: GameState;
  theme: HiveTheme;
  legalMoves: GameMove[];
  selectedPiece: { type: "board"; coord: Coord } | { type: "hand"; pieceType: PieceType } | null;
  lastMoveCoords: Coord[];
  onHexClick: (coord: Coord) => void;
  onPieceClick: (coord: Coord) => void;
  onDeselect?: () => void;
}

export function HexGrid({
  state,
  theme,
  legalMoves,
  selectedPiece,
  lastMoveCoords,
  onHexClick,
  onPieceClick,
  onDeselect,
}: Props) {
  // Parse the board into a list of (coord, stack) pairs.
  const boardEntries = useMemo(() => {
    const entries: { coord: Coord; stack: Piece[] }[] = [];
    for (const [key, stack] of Object.entries(state.board.grid)) {
      entries.push({ coord: parseCoordKey(key), stack: stack as Piece[] });
    }
    return entries;
  }, [state.board.grid]);

  // Calculate legal move destinations.
  const legalDestinations = useMemo(() => {
    const dests = new Set<string>();
    for (const move of legalMoves) {
      if (move === "Pass") continue;
      if ("Place" in move && selectedPiece?.type === "hand") {
        if (move.Place.piece_type === selectedPiece.pieceType) {
          dests.add(`${move.Place.to[0]},${move.Place.to[1]}`);
        }
      } else if ("Move" in move && selectedPiece?.type === "board") {
        if (
          move.Move.from[0] === selectedPiece.coord[0] &&
          move.Move.from[1] === selectedPiece.coord[1]
        ) {
          dests.add(`${move.Move.to[0]},${move.Move.to[1]}`);
        }
      } else if ("PillbugThrow" in move && selectedPiece?.type === "board") {
        // Only show throw destinations when the selected piece is the pillbug doing the throwing.
        if (
          move.PillbugThrow.pillbug_at[0] === selectedPiece.coord[0] &&
          move.PillbugThrow.pillbug_at[1] === selectedPiece.coord[1]
        ) {
          dests.add(
            `${move.PillbugThrow.to[0]},${move.PillbugThrow.to[1]}`
          );
        }
      }
    }
    return dests;
  }, [legalMoves, selectedPiece]);

  // Compute viewBox.
  const { allHexes, viewBox } = useMemo(() => {
    // Include board positions + legal destinations.
    const allCoords: Coord[] = boardEntries.map((e) => e.coord);

    // Add candidate placement positions (empty neighbors of board).
    if (selectedPiece) {
      for (const destKey of legalDestinations) {
        const [q, r] = destKey.split(",").map(Number);
        allCoords.push([q, r]);
      }
    }

    if (allCoords.length === 0) {
      allCoords.push([0, 0]);
    }

    const pixels = allCoords.map(([q, r]) => axialToPixel(q, r, HEX_SIZE));
    const minX = Math.min(...pixels.map((p) => p.x)) - HEX_SIZE * 2;
    const maxX = Math.max(...pixels.map((p) => p.x)) + HEX_SIZE * 2;
    const minY = Math.min(...pixels.map((p) => p.y)) - HEX_SIZE * 2;
    const maxY = Math.max(...pixels.map((p) => p.y)) + HEX_SIZE * 2;

    return {
      allHexes: allCoords,
      viewBox: `${minX} ${minY} ${maxX - minX} ${maxY - minY}`,
    };
  }, [boardEntries, selectedPiece, legalDestinations]);

  const lastMoveSet = useMemo(
    () => new Set(lastMoveCoords.map(([q, r]) => `${q},${r}`)),
    [lastMoveCoords]
  );

  return (
    <svg
      viewBox={viewBox}
      className="w-full h-full"
      style={{ background: theme.board.background }}
    >
      {/* Invisible background rect to capture clicks on empty space */}
      <rect
        x={viewBox.split(" ")[0]}
        y={viewBox.split(" ")[1]}
        width={viewBox.split(" ")[2]}
        height={viewBox.split(" ")[3]}
        fill="transparent"
        onClick={onDeselect}
      />

      {/* Legal move destinations (empty hexes you can click) */}
      {selectedPiece &&
        Array.from(legalDestinations).map((key) => {
          const [q, r] = key.split(",").map(Number);
          const { x, y } = axialToPixel(q, r, HEX_SIZE);
          return (
            <polygon
              key={`dest-${key}`}
              points={hexPoints(x, y, HEX_SIZE - 1)}
              fill={theme.board.highlightColor}
              stroke={theme.board.gridLineColor}
              strokeWidth={theme.board.gridLineWidth}
              className="cursor-pointer hover:opacity-80"
              onClick={() => onHexClick([q, r])}
            />
          );
        })}

      {/* Board pieces */}
      {boardEntries.map(({ coord, stack }) => {
        const [q, r] = coord;
        const { x, y } = axialToPixel(q, r, HEX_SIZE);
        const topPiece = stack[stack.length - 1];
        const isWhite = topPiece.color === "White";
        const coordKey = `${q},${r}`;
        const isSelected =
          selectedPiece?.type === "board" &&
          selectedPiece.coord[0] === q &&
          selectedPiece.coord[1] === r;
        const isLastMove = lastMoveSet.has(coordKey);
        const isStacked = stack.length > 1;

        let fill = isWhite ? theme.pieces.whiteColor : theme.pieces.blackColor;
        if (isSelected) fill = theme.board.selectedColor;

        return (
          <g
            key={`piece-${q}-${r}`}
            className="cursor-pointer"
            onClick={() => onPieceClick(coord)}
          >
            {/* Last move indicator */}
            {isLastMove && (
              <polygon
                points={hexPoints(x, y, HEX_SIZE + 2)}
                fill="none"
                stroke={theme.board.lastMoveColor}
                strokeWidth={3}
              />
            )}

            {/* Stacked piece shadow layers for depth effect */}
            {isStacked &&
              stack.slice(0, -1).reverse().map((piece, i) => {
                const offset = (i + 1) * 3;
                const layerColor =
                  piece.color === "White"
                    ? theme.pieces.whiteColor
                    : theme.pieces.blackColor;
                const layerBorder =
                  piece.color === "White"
                    ? theme.pieces.whiteBorder
                    : theme.pieces.blackBorder;
                return (
                  <polygon
                    key={`shadow-${i}`}
                    points={hexPoints(x + offset, y + offset, HEX_SIZE - 3)}
                    fill={layerColor}
                    stroke={layerBorder}
                    strokeWidth={theme.pieces.borderWidth * 0.7}
                    opacity={0.45 - i * 0.1}
                  />
                );
              })}

            {/* Hex tile */}
            <polygon
              points={hexPoints(x, y, HEX_SIZE - 2)}
              fill={fill}
              stroke={
                isWhite
                  ? theme.pieces.whiteBorder
                  : theme.pieces.blackBorder
              }
              strokeWidth={theme.pieces.borderWidth}
            />

            {/* Piece label */}
            <text
              x={x}
              y={y + theme.pieces.fontSize * 0.35}
              fontSize={theme.pieces.fontSize}
              fill={theme.pieces.textColor(topPiece.color)}
              textAnchor="middle"
              style={{ pointerEvents: "none", userSelect: "none" }}
            >
              {theme.pieces.renderLabel(topPiece.piece_type)}
            </text>

            {/* Stack indicator badge and color dots */}
            {isStacked && (
              <>
                {/* Badge background */}
                <circle
                  cx={x + HEX_SIZE * 0.55}
                  cy={y - HEX_SIZE * 0.45}
                  r={8}
                  fill="#18181b"
                  stroke="#fbbf24"
                  strokeWidth={1.5}
                />
                {/* Badge number */}
                <text
                  x={x + HEX_SIZE * 0.55}
                  y={y - HEX_SIZE * 0.45 + 3.5}
                  fontSize={9}
                  fill="#fbbf24"
                  textAnchor="middle"
                  fontWeight="bold"
                  style={{ pointerEvents: "none", userSelect: "none" }}
                >
                  {stack.length}
                </text>
                {/* Mini color dots showing stack composition (bottom to top) */}
                {stack.slice(0, -1).map((piece, i) => {
                  const dotColor =
                    piece.color === "White"
                      ? theme.pieces.whiteColor
                      : theme.pieces.blackColor;
                  const dotBorder =
                    piece.color === "White"
                      ? theme.pieces.whiteBorder
                      : theme.pieces.blackBorder;
                  return (
                    <circle
                      key={`dot-${i}`}
                      cx={x - HEX_SIZE * 0.55 + i * 9}
                      cy={y + HEX_SIZE * 0.55}
                      r={3.5}
                      fill={dotColor}
                      stroke={dotBorder}
                      strokeWidth={0.8}
                    />
                  );
                })}
              </>
            )}
          </g>
        );
      })}

      {/* Empty origin indicator when board is empty */}
      {boardEntries.length === 0 && !selectedPiece && (
        <polygon
          points={hexPoints(0, 0, HEX_SIZE - 2)}
          fill="none"
          stroke={theme.board.gridLineColor}
          strokeWidth={1}
          strokeDasharray="4,4"
        />
      )}
    </svg>
  );
}
