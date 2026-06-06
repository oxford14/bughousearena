"use client";

import { useMemo } from "react";
import { Chessboard } from "react-chessboard";
import { Badge } from "@/components/ui/badge";
import { getArenaChessboardOptions } from "@/lib/game/arena-board-theme";
import { getPhysicalBoardResultStatus } from "@/lib/game/match-end";
import {
  getPhysicalBoardLabel,
  getSeatColor,
  PHYSICAL_BOARD_SEATS,
  type BoardSeatId,
  type PhysicalBoardId,
} from "@/lib/game/bughouse-engine";
import type { BoardDocument, MatchDocument, MatchPlayer } from "@/types/firestore";
import { cn } from "@/lib/utils";

interface MatchResultBoardProps {
  physicalId: PhysicalBoardId;
  match: MatchDocument;
  boards: BoardDocument[];
  players: MatchPlayer[];
}

function seatPlayer(players: MatchPlayer[], seatId: BoardSeatId): MatchPlayer | undefined {
  return players.find((p) => p.boardId === seatId);
}

const STATUS_LABEL = {
  checkmate: "Checkmate",
  stalemate: "Frozen",
  time_forfeit: "Time forfeit",
  active: "Active",
} as const;

function timedOutPlayerName(
  boards: BoardDocument[],
  players: MatchPlayer[],
  physicalId: PhysicalBoardId
): string | null {
  const seatIds = PHYSICAL_BOARD_SEATS[physicalId];
  const primary = boards.find((b) => b.id === seatIds[0]);
  if (!primary) return null;

  const whiteSeat = seatIds.find((id) => getSeatColor(id) === "w")!;
  const blackSeat = seatIds.find((id) => getSeatColor(id) === "b")!;

  if ((primary.whiteClock ?? 300) <= 0) {
    return seatPlayer(players, whiteSeat)?.displayName ?? "White";
  }
  if ((primary.blackClock ?? 300) <= 0) {
    return seatPlayer(players, blackSeat)?.displayName ?? "Black";
  }
  return null;
}

export function MatchResultBoard({
  physicalId,
  match,
  boards,
  players,
}: MatchResultBoardProps) {
  const seatIds = PHYSICAL_BOARD_SEATS[physicalId];
  const whiteSeat = seatIds.find((id) => getSeatColor(id) === "w")!;
  const blackSeat = seatIds.find((id) => getSeatColor(id) === "b")!;
  const primaryBoard = boards.find((b) => b.id === seatIds[0]);
  const whitePlayer = seatPlayer(players, whiteSeat);
  const blackPlayer = seatPlayer(players, blackSeat);
  const status = getPhysicalBoardResultStatus(match, boards, physicalId);
  const timedOut = status === "time_forfeit" ? timedOutPlayerName(boards, players, physicalId) : null;

  const chessboardOptions = useMemo(
    () =>
      getArenaChessboardOptions({
        position: primaryBoard?.fen ?? "start",
        boardOrientation: "white",
        allowDragging: false,
        allowDragOffBoard: false,
      }),
    [primaryBoard?.fen]
  );

  return (
    <div
      className={cn(
        "rounded-xl border bg-[#0a0618]/60 p-3",
        status === "time_forfeit"
          ? "border-amber-500/35 shadow-[0_0_20px_rgba(245,158,11,0.08)]"
          : status === "checkmate"
            ? "border-red-500/30"
            : "border-primary/20"
      )}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-secondary">
          {getPhysicalBoardLabel(physicalId)}
        </p>
        <Badge
          variant={status === "checkmate" ? "destructive" : "secondary"}
          className={cn(
            "text-[10px] capitalize",
            status === "checkmate" && "bg-red-500/20 text-red-300 border-red-500/30",
            status === "time_forfeit" &&
              "bg-amber-500/20 text-amber-300 border-amber-500/30 font-semibold uppercase tracking-wide"
          )}
        >
          {STATUS_LABEL[status]}
        </Badge>
      </div>

      {timedOut ? (
        <p className="mb-2 text-[11px] text-amber-300/90">
          {timedOut} ran out of time
        </p>
      ) : null}

      <div className="flex justify-between gap-2 mb-2 text-[11px] text-muted-foreground">
        <span className="truncate">
          <span className="text-foreground/90">{whitePlayer?.displayName ?? "White"}</span>
        </span>
        <span className="shrink-0 text-[10px] uppercase">vs</span>
        <span className="truncate text-right">
          <span className="text-foreground/90">{blackPlayer?.displayName ?? "Black"}</span>
        </span>
      </div>

      <div className="relative mx-auto aspect-square w-full max-w-[220px] rounded-md overflow-hidden">
        <Chessboard options={chessboardOptions} />
      </div>
    </div>
  );
}
