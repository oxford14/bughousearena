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

/** Standard chess starting position for react-chessboard (not the literal string "start"). */
export const STARTING_FEN =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR";

/** @deprecated Use BOARD_THEMES.arena */
export const ARENA_BOARD = BOARD_THEMES.arena;

const SELECTED_SQUARE_STYLE: CSSProperties = {
  background: "rgba(250, 204, 21, 0.5)",
  boxShadow: "inset 0 0 0 2px #facc15",
};

const CHECK_KING_SQUARE_STYLE: CSSProperties = {
  background: "rgba(239, 68, 68, 0.72)",
  boxShadow:
    "inset 0 0 0 3px #ef4444, 0 0 18px rgba(239, 68, 68, 0.85)",
};

const CHECK_ATTACKER_SQUARE_STYLE: CSSProperties = {
  background: "rgba(244, 63, 94, 0.38)",
  boxShadow: "inset 0 0 0 2px #f43f5e",
};

export function buildSquareStyles(
  theme: BoardThemeDefinition,
  options: {
    validDropSquares?: Square[];
    validMoveSquares?: Square[];
    selectedSquare?: string | null;
    hoverSquare?: string | null;
    checkKingSquare?: string | null;
    checkAttackerSquares?: Square[];
  } = {}
): Record<string, CSSProperties> {
  const {
    validDropSquares = [],
    validMoveSquares = [],
    selectedSquare = null,
    hoverSquare = null,
    checkKingSquare = null,
    checkAttackerSquares = [],
  } = options;

  const styles: Record<string, CSSProperties> = {};

  for (const square of validMoveSquares) {
    if (validDropSquares.includes(square)) continue;
    styles[square] = {
      background: hoverSquare === square ? theme.dropHover : theme.dropValid,
      boxShadow:
        hoverSquare === square
          ? "inset 0 0 0 2px #4ade80"
          : "inset 0 0 0 1px rgba(74, 222, 128, 0.45)",
    };
  }

  for (const square of validDropSquares) {
    styles[square] = {
      background: hoverSquare === square ? theme.dropHover : theme.dropValid,
      boxShadow:
        hoverSquare === square
          ? "inset 0 0 0 2px #4ade80"
          : "inset 0 0 0 1px rgba(74, 222, 128, 0.45)",
    };
  }

  if (selectedSquare) {
    styles[selectedSquare] = {
      ...styles[selectedSquare],
      ...SELECTED_SQUARE_STYLE,
    };
  }

  for (const square of checkAttackerSquares) {
    if (square === checkKingSquare) continue;
    styles[square] = {
      ...styles[square],
      ...CHECK_ATTACKER_SQUARE_STYLE,
    };
  }

  if (checkKingSquare) {
    styles[checkKingSquare] = {
      ...styles[checkKingSquare],
      ...CHECK_KING_SQUARE_STYLE,
    };
  }

  return styles;
}

export function getChessboardOptions(
  themeId: BoardThemeId,
  overrides: ChessboardOptions & {
    validDropSquares?: Square[];
    validMoveSquares?: Square[];
    selectedSquare?: string | null;
    hoverSquare?: string | null;
    checkKingSquare?: string | null;
    checkAttackerSquares?: Square[];
  }
): ChessboardOptions {
  const theme = BOARD_THEMES[themeId] ?? BOARD_THEMES.arena;
  const {
    validDropSquares = [],
    validMoveSquares = [],
    selectedSquare = null,
    hoverSquare = null,
    checkKingSquare = null,
    checkAttackerSquares = [],
    squareStyles,
    pieces,
    ...rest
  } = overrides;

  return {
    pieces: pieces ?? arenaPieces,
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
      ...buildSquareStyles(theme, {
        validDropSquares,
        validMoveSquares,
        selectedSquare,
        hoverSquare,
        checkKingSquare,
        checkAttackerSquares,
      }),
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
    validMoveSquares?: Square[];
    selectedSquare?: string | null;
    hoverSquare?: string | null;
    checkKingSquare?: string | null;
    checkAttackerSquares?: Square[];
  }
): ChessboardOptions {
  return getChessboardOptions("arena", overrides);
}
