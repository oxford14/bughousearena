"use client";

import { useMemo } from "react";
import { Chessboard } from "react-chessboard";
import { getChessboardOptions, STARTING_FEN } from "@/lib/game/arena-board-theme";
import {
  getPhysicalBoardLabelForSeat,
  type BoardSeatId,
} from "@/lib/game/bughouse-engine";
import { teamSeatForColor } from "@/lib/game/match-setup";
import type { PlayerColor } from "@/types/firestore";
import { useBoardTheme } from "@/providers/board-theme-provider";
import { usePieceSet } from "@/providers/piece-set-provider";
import { cn } from "@/lib/utils";

interface SetupSeatPreviewProps {
  team: 1 | 2;
  previewColor: PlayerColor | null;
  className?: string;
}

export function SetupSeatPreview({ team, previewColor, className }: SetupSeatPreviewProps) {
  const { themeId } = useBoardTheme();
  const { pieces } = usePieceSet();

  const chessboardOptions = useMemo(
    () =>
      getChessboardOptions(themeId, {
        pieces,
        position: STARTING_FEN,
        boardOrientation: previewColor === "b" ? "black" : "white",
        allowDragging: false,
        showAnimations: false,
      }),
    [previewColor, themeId, pieces]
  );

  if (!previewColor) {
    return (
      <div
        className={cn(
          "rounded-xl border border-dashed border-primary/25 bg-muted/10 px-4 py-6 text-center text-sm text-muted-foreground",
          className
        )}
      >
        Pick white or black to preview your seat
      </div>
    );
  }

  const seatId = teamSeatForColor(team, previewColor);
  const boardLabel = getPhysicalBoardLabelForSeat(seatId as BoardSeatId);
  const colorLabel = previewColor === "w" ? "White" : "Black";

  return (
    <div
      className={cn(
        "rounded-xl border border-primary/25 bg-[#0a0618]/50 p-4 space-y-3",
        className
      )}
    >
      <p className="text-center text-sm text-secondary">
        You&apos;ll play on{" "}
        <span className="font-semibold text-foreground">{boardLabel}</span> as{" "}
        <span className="font-semibold text-foreground">{colorLabel}</span>
      </p>
      <div className="mx-auto aspect-square w-full max-w-[180px]">
        <Chessboard options={chessboardOptions} />
      </div>
    </div>
  );
}

export function formatSetupSeatLabel(
  team: 1 | 2,
  previewColor: PlayerColor | null
): string | null {
  if (!previewColor) return null;
  const seatId = teamSeatForColor(team, previewColor);
  const boardLabel = getPhysicalBoardLabelForSeat(seatId as BoardSeatId);
  const colorLabel = previewColor === "w" ? "White" : "Black";
  return `${boardLabel} · ${colorLabel}`;
}
