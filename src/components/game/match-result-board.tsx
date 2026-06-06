"use client";

import { useMemo } from "react";
import { Chessboard } from "react-chessboard";
import { Badge } from "@/components/ui/badge";
import { getArenaChessboardOptions } from "@/lib/game/arena-board-theme";
import {
  getPhysicalBoardLabel,
  getSeatColor,
  PHYSICAL_BOARD_SEATS,
  type BoardSeatId,
  type PhysicalBoardId,
} from "@/lib/game/bughouse-engine";
import type { BoardDocument, MatchPlayer } from "@/types/firestore";
import { cn } from "@/lib/utils";

interface MatchResultBoardProps {
  physicalId: PhysicalBoardId;
  boards: BoardDocument[];
  players: MatchPlayer[];
}

function seatPlayer(players: MatchPlayer[], seatId: BoardSeatId): MatchPlayer | undefined {
  return players.find((p) => p.boardId === seatId);
}

function physicalStatus(
  boards: BoardDocument[],
  physicalId: PhysicalBoardId
): "checkmate" | "stalemate" | "active" {
  const seatBoards = PHYSICAL_BOARD_SEATS[physicalId]
    .map((seatId) => boards.find((b) => b.id === seatId))
    .filter((b): b is BoardDocument => b != null);

  if (seatBoards.some((b) => b.boardStatus === "checkmate")) return "checkmate";
  if (seatBoards.some((b) => b.boardStatus === "stalemate")) return "stalemate";
  return "active";
}

const STATUS_LABEL = {
  checkmate: "Checkmate",
  stalemate: "Frozen",
  active: "Active",
} as const;

export function MatchResultBoard({ physicalId, boards, players }: MatchResultBoardProps) {
  const seatIds = PHYSICAL_BOARD_SEATS[physicalId];
  const whiteSeat = seatIds.find((id) => getSeatColor(id) === "w")!;
  const blackSeat = seatIds.find((id) => getSeatColor(id) === "b")!;
  const primaryBoard = boards.find((b) => b.id === seatIds[0]);
  const whitePlayer = seatPlayer(players, whiteSeat);
  const blackPlayer = seatPlayer(players, blackSeat);
  const status = physicalStatus(boards, physicalId);

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
    <div className="rounded-xl border border-primary/20 bg-[#0a0618]/60 p-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-secondary">
          {getPhysicalBoardLabel(physicalId)}
        </p>
        <Badge
          variant={status === "checkmate" ? "destructive" : "secondary"}
          className={cn(
            "text-[10px] capitalize",
            status === "checkmate" && "bg-red-500/20 text-red-300 border-red-500/30"
          )}
        >
          {STATUS_LABEL[status]}
        </Badge>
      </div>

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
