"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { previewActionOnBoards } from "@/lib/game/optimistic-boards";
import type { BoardDocument } from "@/types/firestore";
import type { PieceSymbol } from "@/lib/game/bughouse-engine";

interface PendingMove {
  boardId: string;
  move: string;
}

/**
 * Shows moves immediately on the client while Firestore transactions complete.
 * Without this, the board stays on the old FEN until the server round-trip (~1–3s).
 */
export function useOptimisticBoards(serverBoards: BoardDocument[]) {
  const [optimisticBoards, setOptimisticBoards] = useState<BoardDocument[] | null>(
    null
  );
  const pendingRef = useRef<PendingMove | null>(null);

  const displayBoards = optimisticBoards ?? serverBoards;

  const applyOptimistic = useCallback(
    (boardId: string, move: string, promotion?: PieceSymbol): boolean => {
      const base = optimisticBoards ?? serverBoards;
      const next = previewActionOnBoards(base, boardId, move, promotion);
      if (!next) return false;
      pendingRef.current = { boardId, move };
      setOptimisticBoards(next);
      return true;
    },
    [optimisticBoards, serverBoards]
  );

  const clearOptimistic = useCallback(() => {
    pendingRef.current = null;
    setOptimisticBoards(null);
  }, []);

  useEffect(() => {
    const pending = pendingRef.current;
    if (!pending || !optimisticBoards) return;

    const serverBoard = serverBoards.find((b) => b.id === pending.boardId);
    const optimisticBoard = optimisticBoards.find((b) => b.id === pending.boardId);
    if (!serverBoard || !optimisticBoard) return;

    const serverCaughtUp =
      serverBoard.lastMove === pending.move ||
      serverBoard.fen === optimisticBoard.fen;

    if (serverCaughtUp) {
      clearOptimistic();
    }
  }, [serverBoards, optimisticBoards, clearOptimistic]);

  return { displayBoards, applyOptimistic, clearOptimistic };
}
