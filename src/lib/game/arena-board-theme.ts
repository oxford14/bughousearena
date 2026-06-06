import type { CSSProperties } from "react";
import type { ChessboardOptions } from "react-chessboard";
import type { Square } from "chess.js";
import { arenaPieces } from "@/components/game/arena-pieces";

export const ARENA_BOARD = {
  darkSquare: "#2a1654",
  lightSquare: "#3d2570",
  dropValid: "rgba(74, 222, 128, 0.42)",
  dropHover: "rgba(74, 222, 128, 0.72)",
  dropDrag: "rgba(74, 222, 128, 0.55)",
  notation: "rgba(167, 139, 250, 0.65)",
  frameGlow: "0 0 28px rgba(124, 58, 237, 0.45), 0 0 8px rgba(244, 63, 94, 0.15)",
  innerBorder: "rgba(244, 63, 94, 0.35)",
} as const;

export function buildSquareStyles(
  validDropSquares: Square[],
  hoverSquare: string | null
): Record<string, CSSProperties> {
  const styles: Record<string, CSSProperties> = {};
  for (const square of validDropSquares) {
    styles[square] = {
      background:
        hoverSquare === square ? ARENA_BOARD.dropHover : ARENA_BOARD.dropValid,
      boxShadow:
        hoverSquare === square
          ? "inset 0 0 0 2px #4ade80"
          : "inset 0 0 0 1px rgba(74, 222, 128, 0.45)",
    };
  }
  return styles;
}

export function getArenaChessboardOptions(
  overrides: ChessboardOptions & {
    validDropSquares?: Square[];
    hoverSquare?: string | null;
  }
): ChessboardOptions {
  const { validDropSquares = [], hoverSquare = null, ...rest } = overrides;

  return {
    pieces: arenaPieces,
    darkSquareStyle: { backgroundColor: ARENA_BOARD.darkSquare },
    lightSquareStyle: { backgroundColor: ARENA_BOARD.lightSquare },
    darkSquareNotationStyle: { color: ARENA_BOARD.notation },
    lightSquareNotationStyle: { color: ARENA_BOARD.notation },
    alphaNotationStyle: {
      color: ARENA_BOARD.notation,
      fontSize: "10px",
      fontWeight: 600,
    },
    numericNotationStyle: {
      color: ARENA_BOARD.notation,
      fontSize: "10px",
      fontWeight: 600,
    },
    dropSquareStyle: {
      backgroundColor: ARENA_BOARD.dropDrag,
      boxShadow: "inset 0 0 0 2px #4ade80",
    },
    squareStyles: buildSquareStyles(validDropSquares, hoverSquare),
    boardStyle: {
      borderRadius: "6px",
      boxShadow: ARENA_BOARD.frameGlow,
      border: `2px solid ${ARENA_BOARD.innerBorder}`,
      overflow: "hidden",
    },
    ...rest,
  };
}
