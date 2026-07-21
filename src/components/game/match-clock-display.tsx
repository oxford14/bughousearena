"use client";

import { useEffect, useMemo, useRef } from "react";
import type { BoardDocument, MatchDocument } from "@/types/firestore";
import { buildPhysicalDisplays } from "@/hooks/use-match-clocks";
import {
  BOARD_IDS,
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
import { SINGLE_BOARD_ID } from "@/lib/game/single-board-engine";
import { useSound } from "@/providers/sound-provider";

/** Start per-second tick SFX once this many seconds remain on your clock. */
const LOW_TIME_TICK_SEC = 10;

function isBughouseSeatId(boardId: string): boardId is BoardSeatId {
  return BOARD_IDS.includes(boardId as BoardSeatId);
}

function tickSingleBoardClocks(
  board: BoardDocument,
  nowMs: number
): { white: number; black: number; whiteRunning: boolean; blackRunning: boolean } {
  const last = board.clockUpdatedAtMs ?? nowMs;
  const elapsed = Math.max(0, (nowMs - last) / 1000);
  let white = board.whiteClock ?? 300;
  let black = board.blackClock ?? 300;
  const running = board.clockRunning;
  if (running === "w") white = Math.max(0, white - elapsed);
  if (running === "b") black = Math.max(0, black - elapsed);
  return {
    white: Math.floor(white),
    black: Math.floor(black),
    whiteRunning: running === "w",
    blackRunning: running === "b",
  };
}

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
  seatColor: seatColorProp,
  lowTimeTick = false,
}: {
  boardId: string;
  boards: BoardDocument[];
  match: MatchDocument;
  side: "mine" | "opponent";
  /** Required for 1v1 single-board (no Bughouse seat map). */
  seatColor?: PlayerColor;
  /** Play countdown ticks when this clock is running and ≤10s (your seat only). */
  lowTimeTick?: boolean;
}) {
  const nowMs = useMatchNow();
  const { play } = useSound();
  const lastTickSecRef = useRef<number | null>(null);

  const display = useMemo(() => {
    // Standard / Crazyhouse: one board with whiteClock / blackClock.
    if (!isBughouseSeatId(boardId)) {
      const board =
        boards.find((b) => b.id === boardId) ??
        boards.find((b) => b.id === SINGLE_BOARD_ID) ??
        boards[0];
      if (!board) return { time: 0, running: false };
      const clocks = tickSingleBoardClocks(board, nowMs);
      const myColor: PlayerColor =
        seatColorProp ?? board.playerColor ?? "w";
      if (side === "mine") {
        return {
          time: myColor === "w" ? clocks.white : clocks.black,
          running: myColor === "w" ? clocks.whiteRunning : clocks.blackRunning,
        };
      }
      const opponentColor: PlayerColor = myColor === "w" ? "b" : "w";
      return {
        time: opponentColor === "w" ? clocks.white : clocks.black,
        running:
          opponentColor === "w" ? clocks.whiteRunning : clocks.blackRunning,
      };
    }

    const physicalId = getPhysicalBoard(boardId);
    const displays = buildPhysicalDisplays(boards, match, nowMs);
    const clockDisplay = displays[physicalId];
    const seatColor = getSeatColor(boardId);
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
  }, [boardId, boards, match, nowMs, side, seatColorProp]);

  useEffect(() => {
    if (!lowTimeTick || match.status !== "active") {
      lastTickSecRef.current = null;
      return;
    }
    if (!display.running || display.time <= 0 || display.time > LOW_TIME_TICK_SEC) {
      lastTickSecRef.current = null;
      return;
    }
    const sec = Math.floor(display.time);
    if (lastTickSecRef.current === sec) return;
    lastTickSecRef.current = sec;
    play("clockTick");
  }, [
    lowTimeTick,
    match.status,
    display.running,
    display.time,
    play,
  ]);

  const urgent =
    lowTimeTick &&
    display.running &&
    display.time > 0 &&
    display.time <= LOW_TIME_TICK_SEC;

  return (
    <span
      className={`ml-auto text-xs tabular-nums shrink-0 ${
        urgent
          ? "text-rose-400 font-semibold animate-pulse"
          : display.running
            ? "text-primary font-semibold neon-glow"
            : "text-muted-foreground"
      }`}
    >
      {formatClock(display.time)}
    </span>
  );
}
