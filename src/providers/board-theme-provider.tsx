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
  DEFAULT_BOARD_THEME_ID,
  type BoardThemeDefinition,
  type BoardThemeId,
  isBoardThemeId,
} from "@/lib/game/board-themes";
import { boardThemeManager } from "@/lib/game/board-theme-manager";
import { useAuth } from "@/providers/auth-provider";
import { isBoardThemeUnlocked } from "@/lib/shop/inventory";
import { equipShopItem } from "@/lib/shop/shop-api";

interface BoardThemeContextValue {
  themeId: BoardThemeId;
  theme: BoardThemeDefinition;
  themes: BoardThemeDefinition[];
  setThemeId: (themeId: BoardThemeId) => void;
  isUnlocked: (id: BoardThemeId) => boolean;
}

const BoardThemeContext = createContext<BoardThemeContextValue | null>(null);

export function BoardThemeProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const [themeId, setThemeIdState] = useState<BoardThemeId>(boardThemeManager.getThemeId());

  useEffect(() => {
    const equipped = profile?.equippedBoardTheme;
    if (equipped && isBoardThemeId(equipped) && isBoardThemeUnlocked(profile, equipped)) {
      setThemeIdState(equipped);
      boardThemeManager.setThemeId(equipped);
      return;
    }
    setThemeIdState(boardThemeManager.getThemeId());
    return boardThemeManager.subscribe(() => {
      setThemeIdState(boardThemeManager.getThemeId());
    });
  }, [profile?.equippedBoardTheme, profile?.ownedItems]);

  const setThemeId = useCallback(
    (id: BoardThemeId) => {
      if (!isBoardThemeUnlocked(profile, id)) return;
      boardThemeManager.setThemeId(id);
      setThemeIdState(id);
      void equipShopItem("boardTheme", id).catch(() => {});
    },
    [profile]
  );

  const value = useMemo<BoardThemeContextValue>(() => {
    const theme =
      BOARD_THEME_LIST.find((entry) => entry.id === themeId) ?? BOARD_THEME_LIST[1]!;
    return {
      themeId,
      theme,
      themes: BOARD_THEME_LIST,
      setThemeId,
      isUnlocked: (id) => isBoardThemeUnlocked(profile, id),
    };
  }, [profile, setThemeId, themeId]);

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
