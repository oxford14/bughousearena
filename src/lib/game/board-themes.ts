export type BoardThemeId =
  | "classic"
  | "arena"
  | "forest"
  | "neon"
  | "obsidian"
  | "sakura"
  | "tournament";

export interface BoardThemeDefinition {
  id: BoardThemeId;
  label: string;
  /** Free themes need no shop purchase. */
  premium?: boolean;
  darkSquare: string;
  lightSquare: string;
  dropValid: string;
  dropHover: string;
  dropDrag: string;
  notation: string;
  frameGlow: string;
  innerBorder: string;
}

export const FREE_BOARD_THEME_IDS: BoardThemeId[] = ["classic", "arena", "forest"];

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
  neon: {
    id: "neon",
    label: "Neon Grid",
    premium: true,
    darkSquare: "#1a0a2e",
    lightSquare: "#2d1b69",
    dropValid: "rgba(244, 63, 94, 0.45)",
    dropHover: "rgba(244, 63, 94, 0.75)",
    dropDrag: "rgba(236, 72, 153, 0.55)",
    notation: "rgba(244, 114, 182, 0.7)",
    frameGlow: "0 0 32px rgba(236, 72, 153, 0.5), 0 0 12px rgba(124, 58, 237, 0.4)",
    innerBorder: "rgba(236, 72, 153, 0.45)",
  },
  obsidian: {
    id: "obsidian",
    label: "Obsidian",
    premium: true,
    darkSquare: "#1c1c1e",
    lightSquare: "#3a3a3c",
    dropValid: "rgba(251, 191, 36, 0.4)",
    dropHover: "rgba(251, 191, 36, 0.65)",
    dropDrag: "rgba(251, 191, 36, 0.5)",
    notation: "rgba(251, 191, 36, 0.55)",
    frameGlow: "0 0 20px rgba(251, 191, 36, 0.2)",
    innerBorder: "rgba(251, 191, 36, 0.35)",
  },
  sakura: {
    id: "sakura",
    label: "Sakura",
    premium: true,
    darkSquare: "#d4a5a5",
    lightSquare: "#fce4ec",
    dropValid: "rgba(236, 72, 153, 0.4)",
    dropHover: "rgba(236, 72, 153, 0.65)",
    dropDrag: "rgba(244, 114, 182, 0.5)",
    notation: "rgba(190, 80, 100, 0.55)",
    frameGlow: "0 2px 16px rgba(244, 114, 182, 0.25)",
    innerBorder: "rgba(244, 114, 182, 0.35)",
  },
  tournament: {
    id: "tournament",
    label: "Tournament",
    premium: true,
    darkSquare: "#4a5568",
    lightSquare: "#e2e8f0",
    dropValid: "rgba(59, 130, 246, 0.45)",
    dropHover: "rgba(59, 130, 246, 0.7)",
    dropDrag: "rgba(59, 130, 246, 0.55)",
    notation: "rgba(30, 41, 59, 0.6)",
    frameGlow: "0 2px 8px rgba(0, 0, 0, 0.35)",
    innerBorder: "rgba(59, 130, 246, 0.4)",
  },
};

export const BOARD_THEME_LIST = Object.values(BOARD_THEMES);

export const DEFAULT_BOARD_THEME_ID: BoardThemeId = "arena";

export function isBoardThemeId(value: string): value is BoardThemeId {
  return value in BOARD_THEMES;
}
