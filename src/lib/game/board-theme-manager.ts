import {
  BOARD_THEMES,
  DEFAULT_BOARD_THEME_ID,
  isBoardThemeId,
  type BoardThemeId,
} from "./board-themes";

export const BOARD_THEME_STORAGE_KEY = "bughouse-board-theme";

type BoardThemeListener = () => void;

class BoardThemeManager {
  private themeId: BoardThemeId = DEFAULT_BOARD_THEME_ID;
  private listeners = new Set<BoardThemeListener>();

  constructor() {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(BOARD_THEME_STORAGE_KEY);
      if (stored && isBoardThemeId(stored)) {
        this.themeId = stored;
      }
    }
  }

  getThemeId(): BoardThemeId {
    return this.themeId;
  }

  setThemeId(themeId: BoardThemeId): void {
    if (!BOARD_THEMES[themeId]) return;
    this.themeId = themeId;
    if (typeof window !== "undefined") {
      localStorage.setItem(BOARD_THEME_STORAGE_KEY, themeId);
    }
    this.listeners.forEach((listener) => listener());
  }

  subscribe(listener: BoardThemeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export const boardThemeManager = new BoardThemeManager();
