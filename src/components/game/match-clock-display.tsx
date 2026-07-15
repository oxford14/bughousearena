"use client";

import { useEffect, useMemo, useRef } from "react";
import type { BoardDocument, MatchDocument } from "@/types/firestore";
import { buildPhysicalDisplays } from "@/hooks/use-match-clocks";
import {
  getPhysicalBoard,
  getPhysicalBoardLabel,
  getSeatColor,
  PHYSICAL_BOARD_SEATS,
  type BoardSeatId,
  type PhysicalBoardId,
  type PlayerColor,
} from "@/lib/game/bughouse-engine";
import { formatClock } from "@/lib/game/clock-manager";
import { submitTimeForfeit } from "@/lib/game/match-actions";
import { useMatchNow } from "@/components/game/match-now-context";
import type { MatchPlayer } from "@/types/firestore";

export function useMatchClockForfeit(match: MatchDocument, boards: BoardDocument[]) {
  const forfeitSentRef = useRef(false);
  const matchRef = useRef(match);
  const boardsRef = useRef(boards);
  matchRef.current = match;
  boardsRef.current = boards;

  useEffect(() => {
    forfeitSentRef.current = false;
  }, [match.id]);

  useEffect(() => {
    if (match.status !== "active") return;

    const interval = setInterval(() => {
      if (forfeitSentRef.current) return;
      const nowMs = Date.now();
      const displays = buildPhysicalDisplays(boardsRef.current, matchRef.current, nowMs);
      const expired = (["alpha", "bravo"] as PhysicalBoardId[]).some(
        (id) => displays[id].white <= 0 || displays[id].black <= 0
      );
      if (!expired) return;
      forfeitSentRef.current = true;
      void submitTimeForfeit(matchRef.current.id);
    }, 1000);

    return () => clearInterval(interval);
  }, [match.status, match.id]);
}

export function PhysicalMatchClockBar({
  match,
  boards,
}: {
  match: MatchDocument;
  boards: BoardDocument[];
}) {
  const nowMs = useMatchNow();
  const physicalClocks = useMemo(
    () => buildPhysicalDisplays(boards, match, nowMs),
    [boards, match, nowMs]
  );

  const getPhysicalSeatPlayer = (
    physicalId: PhysicalBoardId,
    color: PlayerColor
  ): MatchPlayer | undefined => {
    const seatId = PHYSICAL_BOARD_SEATS[physicalId].find(
      (id) => getSeatColor(id) === color
    );
    if (!seatId) return undefined;
    return match.players.find((p) => p.boardId === seatId);
  };

  return (
    <div className="flex gap-6 flex-wrap">
      {(["alpha", "bravo"] as const).map((physicalId) => {
        const clocks = physicalClocks[physicalId];
        return (
          <div key={physicalId}>
            <p className="text-xs text-muted-foreground mb-1">
              {getPhysicalBoardLabel(physicalId)}
            </p>
            <div className="flex gap-4 text-sm flex-wrap">
              {(["w", "b"] as const).map((color) => {
                const player = getPhysicalSeatPlayer(physicalId, color);
                const time = color === "w" ? clocks.white : clocks.black;
                const running =
                  color === "w" ? clocks.whiteRunning : clocks.blackRunning;
                return (
                  <p
                    key={color}
                    className={`font-heading text-lg tabular-nums ${
                      running ? "text-primary neon-glow" : ""
                    }`}
                  >
                    <span className="font-medium">
                      {player?.displayName ?? (color === "w" ? "White" : "Black")}
                    </span>{" "}
                    {formatClock(time)}
                  </p>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function BoardSeatClock({
  boardId,
  boards,
  match,
  side,
}: {
  boardId: string;
  boards: BoardDocument[];
  match: MatchDocument;
  side: "mine" | "opponent";
}) {
  const nowMs = useMatchNow();
  const display = useMemo(() => {
    const physicalId = getPhysicalBoard(boardId as BoardSeatId);
    const displays = buildPhysicalDisplays(boards, match, nowMs);
    const clockDisplay = displays[physicalId];
    const seatColor = getSeatColor(boardId as BoardSeatId);
    if (side === "mine") {
      return {
        time: seatColor === "w" ? clockDisplay.white : clockDisplay.black,
        running:
          seatColor === "w" ? clockDisplay.whiteRunning : clockDisplay.blackRunning,
      };
    }
    const opponentColor = seatColor === "w" ? "b" : "w";
    return {
      time: opponentColor === "w" ? clockDisplay.white : clockDisplay.black,
      running:
        opponentColor === "w" ? clockDisplay.whiteRunning : clockDisplay.blackRunning,
    };
  }, [boardId, boards, match, nowMs, side]);

  return (
    <span
      className={`ml-auto text-xs tabular-nums shrink-0 ${
        display.running ? "text-primary font-semibold neon-glow" : "text-muted-foreground"
      }`}
    >
      {formatClock(display.time)}
    </span>
  );
}
