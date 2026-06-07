import type { CSSProperties } from "react";
import type { ChessboardOptions } from "react-chessboard";
import type { Square } from "chess.js";
import { arenaPieces } from "@/components/game/arena-pieces";
import {
  BOARD_THEMES,
  type BoardThemeDefinition,
  type BoardThemeId,
} from "./board-themes";

export type { BoardThemeDefinition, BoardThemeId } from "./board-themes";
export {
  BOARD_THEMES,
  BOARD_THEME_LIST,
  DEFAULT_BOARD_THEME_ID,
  isBoardThemeId,
} from "./board-themes";

/** @deprecated Use BOARD_THEMES.arena */
export const ARENA_BOARD = BOARD_THEMES.arena;

export function buildSquareStyles(
  theme: BoardThemeDefinition,
  validDropSquares: Square[],
  hoverSquare: string | null
): Record<string, CSSProperties> {
  const styles: Record<string, CSSProperties> = {};
  for (const square of validDropSquares) {
    styles[square] = {
      background: hoverSquare === square ? theme.dropHover : theme.dropValid,
      boxShadow:
        hoverSquare === square
          ? "inset 0 0 0 2px #4ade80"
          : "inset 0 0 0 1px rgba(74, 222, 128, 0.45)",
    };
  }
  return styles;
}

export function getChessboardOptions(
  themeId: BoardThemeId,
  overrides: ChessboardOptions & {
    validDropSquares?: Square[];
    hoverSquare?: string | null;
  }
): ChessboardOptions {
  const theme = BOARD_THEMES[themeId] ?? BOARD_THEMES.arena;
  const { validDropSquares = [], hoverSquare = null, squareStyles, ...rest } = overrides;

  return {
    pieces: arenaPieces,
    darkSquareStyle: { backgroundColor: theme.darkSquare },
    lightSquareStyle: { backgroundColor: theme.lightSquare },
    darkSquareNotationStyle: { color: theme.notation },
    lightSquareNotationStyle: { color: theme.notation },
    alphaNotationStyle: {
      color: theme.notation,
      fontSize: "10px",
      fontWeight: 600,
    },
    numericNotationStyle: {
      color: theme.notation,
      fontSize: "10px",
      fontWeight: 600,
    },
    dropSquareStyle: {
      backgroundColor: theme.dropDrag,
      boxShadow: "inset 0 0 0 2px #4ade80",
    },
    squareStyles: {
      ...buildSquareStyles(theme, validDropSquares, hoverSquare),
      ...squareStyles,
    },
    boardStyle: {
      borderRadius: "6px",
      boxShadow: theme.frameGlow,
      border: `2px solid ${theme.innerBorder}`,
      overflow: "hidden",
    },
    ...rest,
  };
}

/** @deprecated Use getChessboardOptions("arena", overrides) */
export function getArenaChessboardOptions(
  overrides: ChessboardOptions & {
    validDropSquares?: Square[];
    hoverSquare?: string | null;
  }
): ChessboardOptions {
  return getChessboardOptions("arena", overrides);
}
