export type BoardThemeId = "classic" | "arena" | "forest";

export interface BoardThemeDefinition {
  id: BoardThemeId;
  label: string;
  darkSquare: string;
  lightSquare: string;
  dropValid: string;
  dropHover: string;
  dropDrag: string;
  notation: string;
  frameGlow: string;
  innerBorder: string;
}

export const BOARD_THEMES: Record<BoardThemeId, BoardThemeDefinition> = {
  classic: {
    id: "classic",
    label: "Classic",
    darkSquare: "#b58863",
    lightSquare: "#f0d9b5",
    dropValid: "rgba(74, 222, 128, 0.42)",
    dropHover: "rgba(74, 222, 128, 0.72)",
    dropDrag: "rgba(74, 222, 128, 0.55)",
    notation: "rgba(60, 40, 20, 0.55)",
    frameGlow: "0 2px 12px rgba(0, 0, 0, 0.25)",
    innerBorder: "rgba(120, 80, 40, 0.45)",
  },
  arena: {
    id: "arena",
    label: "Arena",
    darkSquare: "#2a1654",
    lightSquare: "#3d2570",
    dropValid: "rgba(74, 222, 128, 0.42)",
    dropHover: "rgba(74, 222, 128, 0.72)",
    dropDrag: "rgba(74, 222, 128, 0.55)",
    notation: "rgba(167, 139, 250, 0.65)",
    frameGlow: "0 0 28px rgba(124, 58, 237, 0.45), 0 0 8px rgba(244, 63, 94, 0.15)",
    innerBorder: "rgba(244, 63, 94, 0.35)",
  },
  forest: {
    id: "forest",
    label: "Forest",
    darkSquare: "#769656",
    lightSquare: "#eeeed2",
    dropValid: "rgba(74, 222, 128, 0.42)",
    dropHover: "rgba(74, 222, 128, 0.72)",
    dropDrag: "rgba(74, 222, 128, 0.55)",
    notation: "rgba(40, 60, 30, 0.55)",
    frameGlow: "0 2px 12px rgba(0, 0, 0, 0.2)",
    innerBorder: "rgba(60, 90, 45, 0.45)",
  },
};

export const BOARD_THEME_LIST = Object.values(BOARD_THEMES);

export const DEFAULT_BOARD_THEME_ID: BoardThemeId = "arena";

export function isBoardThemeId(value: string): value is BoardThemeId {
  return value in BOARD_THEMES;
}
