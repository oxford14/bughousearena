"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { BoardDocument, MatchDocument } from "@/types/firestore";
import {
  getEffectiveClock,
  getPhysicalBoard,
  getSeatColor,
  getSideToMoveFromFen,
  PHYSICAL_BOARD_SEATS,
  snapshotFromBoardDocs,
  type BoardSeatId,
  type PhysicalBoardId,
  type PlayerColor,
} from "@/lib/game/bughouse-engine";
import { submitTimeForfeit } from "@/lib/game/match-actions";

export interface PhysicalClockDisplay {
  white: number;
  black: number;
  whiteRunning: boolean;
  blackRunning: boolean;
}

function buildPhysicalDisplays(
  boards: BoardDocument[],
  match: MatchDocument,
  nowMs: number
): Record<PhysicalBoardId, PhysicalClockDisplay> {
  const startedAtMs = match.startedAt?.toMillis() ?? 0;
  const snapshot = snapshotFromBoardDocs(
    boards.map((b) => ({
      id: b.id,
      fen: b.fen,
      captured: b.captured,
      playerUid: b.playerUid,
      promotedSquares: b.promotedSquares,
      boardStatus: b.boardStatus,
      whiteClock: b.whiteClock,
      blackClock: b.blackClock,
      clockRunning:
        b.clockRunning ??
        (match.status === "active" && b.boardStatus !== "stalemate"
          ? getSideToMoveFromFen(b.fen)
          : null),
      clockUpdatedAtMs: b.clockUpdatedAtMs ?? startedAtMs,
    }))
  );

  const displays = {} as Record<PhysicalBoardId, PhysicalClockDisplay>;
  for (const id of ["alpha", "bravo"] as PhysicalBoardId[]) {
    const physical = snapshot.physical[id];
    const white = getEffectiveClock(physical, "w", nowMs);
    const black = getEffectiveClock(physical, "b", nowMs);
    displays[id] = {
      white,
      black,
      whiteRunning: physical.clockRunning === "w" && physical.status === "active",
      blackRunning: physical.clockRunning === "b" && physical.status === "active",
    };
  }
  return displays;
}

export function useMatchClocks(match: MatchDocument, boards: BoardDocument[]) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const forfeitSentRef = useRef(false);

  useEffect(() => {
    if (match.status !== "active") return;
    const interval = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [match.status]);

  const physicalClocks = useMemo(
    () => buildPhysicalDisplays(boards, match, nowMs),
    [boards, match, nowMs]
  );

  useEffect(() => {
    if (match.status !== "active" || forfeitSentRef.current) return;

    const expired = (["alpha", "bravo"] as PhysicalBoardId[]).some(
      (id) => physicalClocks[id].white <= 0 || physicalClocks[id].black <= 0
    );
    if (!expired) return;

    forfeitSentRef.current = true;
    void submitTimeForfeit(match.id);
  }, [match.id, match.status, physicalClocks]);

  const getBoardClocks = (boardId: string) => {
    const physicalId = getPhysicalBoard(boardId as BoardSeatId);
    const display = physicalClocks[physicalId];
    const seatColor = getSeatColor(boardId as BoardSeatId);
    const mine = seatColor === "w" ? display.white : display.black;
    const opponent = seatColor === "w" ? display.black : display.white;
    const mineRunning = seatColor === "w" ? display.whiteRunning : display.blackRunning;
    const opponentRunning =
      seatColor === "w" ? display.blackRunning : display.whiteRunning;
    return { mine, opponent, mineRunning, opponentRunning, physicalId };
  };

  const getPhysicalBoardLabel = (physicalId: PhysicalBoardId) =>
    physicalId === "alpha" ? "Board Alpha" : "Board Bravo";

  return {
    physicalClocks,
    getBoardClocks,
    getPhysicalBoardLabel,
    getSeatLabel: (color: PlayerColor, physicalId: PhysicalBoardId) => {
      const seatId = PHYSICAL_BOARD_SEATS[physicalId].find(
        (id) => getSeatColor(id) === color
      );
      if (!seatId) return color === "w" ? "White" : "Black";
      return color === "w"
        ? physicalId === "alpha"
          ? "White Alpha"
          : "White Bravo"
        : physicalId === "alpha"
          ? "Black Alpha"
          : "Black Bravo";
    },
  };
}
