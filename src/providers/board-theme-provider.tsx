"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  BOARD_THEME_LIST,
  type BoardThemeDefinition,
  type BoardThemeId,
} from "@/lib/game/board-themes";
import { boardThemeManager } from "@/lib/game/board-theme-manager";

interface BoardThemeContextValue {
  themeId: BoardThemeId;
  theme: BoardThemeDefinition;
  themes: BoardThemeDefinition[];
  setThemeId: (themeId: BoardThemeId) => void;
}

const BoardThemeContext = createContext<BoardThemeContextValue | null>(null);

export function BoardThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeId, setThemeIdState] = useState<BoardThemeId>(boardThemeManager.getThemeId());

  useEffect(() => {
    setThemeIdState(boardThemeManager.getThemeId());
    return boardThemeManager.subscribe(() => {
      setThemeIdState(boardThemeManager.getThemeId());
    });
  }, []);

  const setThemeId = useCallback((id: BoardThemeId) => {
    boardThemeManager.setThemeId(id);
  }, []);

  const value = useMemo<BoardThemeContextValue>(() => {
    const theme =
      BOARD_THEME_LIST.find((entry) => entry.id === themeId) ?? BOARD_THEME_LIST[1]!;
    return {
      themeId,
      theme,
      themes: BOARD_THEME_LIST,
      setThemeId,
    };
  }, [setThemeId, themeId]);

  return (
    <BoardThemeContext.Provider value={value}>{children}</BoardThemeContext.Provider>
  );
}

export function useBoardTheme() {
  const ctx = useContext(BoardThemeContext);
  if (!ctx) {
    throw new Error("useBoardTheme must be used within BoardThemeProvider");
  }
  return ctx;
}
