import { Chess, type Square } from "chess.js";
import type { BoardDocument } from "@/types/firestore";
import {
  applyAction,
  getPhysicalBoard,
  snapshotFromBoardDocs,
  type BoardSeatId,
  type BughouseSnapshot,
  type GameAction,
  type PieceSymbol,
} from "@/lib/game/bughouse-engine";

function parseAction(
  boardId: BoardSeatId,
  move: string,
  promotion?: PieceSymbol
): GameAction | null {
  if (move.startsWith("drop:")) {
    const [, rest] = move.split(":");
    const [piece, square] = rest!.split("@");
    return {
      type: "drop",
      seatId: boardId,
      piece: piece as PieceSymbol,
      square: square as Square,
    };
  }
  if (move.includes("@")) {
    const [piece, square] = move.split("@");
    return {
      type: "drop",
      seatId: boardId,
      piece: piece as PieceSymbol,
      square: square as Square,
    };
  }
  return { type: "move", seatId: boardId, move, promotion };
}

function loadSnapshotFromBoards(boards: BoardDocument[]) {
  return snapshotFromBoardDocs(
    boards.map((b) => ({
      id: b.id,
      fen: b.fen,
      captured: b.captured,
      playerUid: b.playerUid,
      promotedSquares: b.promotedSquares,
      boardStatus: b.boardStatus,
      whiteClock: b.whiteClock,
      blackClock: b.blackClock,
      clockRunning: b.clockRunning,
      clockUpdatedAtMs: b.clockUpdatedAtMs,
    }))
  );
}

function boardDocsFromSnapshot(
  boards: BoardDocument[],
  snapshot: BughouseSnapshot,
  actingSeatId: BoardSeatId,
  lastMove: string
): BoardDocument[] {
  return boards.map((existing) => {
    const physicalId = getPhysicalBoard(existing.id as BoardSeatId);
    const physical = snapshot.physical[physicalId];
    const seat = snapshot.seats[existing.id as BoardSeatId];
    return {
      ...existing,
      fen: physical.fen,
      captured: seat.reserve,
      turn: physical.fen.includes(" w ") ? "w" : "b",
      lastMove: existing.id === actingSeatId ? lastMove : existing.lastMove,
      isCheck: new Chess(physical.fen).isCheck(),
      isGameOver: physical.status !== "active",
      boardStatus: physical.status,
      promotedSquares: Object.keys(physical.promotedSquares),
      whiteClock: physical.whiteClock,
      blackClock: physical.blackClock,
      clockRunning: physical.clockRunning,
      clockUpdatedAtMs: physical.clockUpdatedAtMs,
    };
  });
}

/** Apply a move locally for instant UI feedback before Firestore confirms. */
export function previewActionOnBoards(
  boards: BoardDocument[],
  boardId: string,
  move: string,
  promotion?: PieceSymbol
): BoardDocument[] | null {
  const seatId = boardId as BoardSeatId;
  const action = parseAction(seatId, move, promotion);
  if (!action) return null;

  const snapshot = loadSnapshotFromBoards(boards);
  const result = applyAction(snapshot, action, Date.now());
  if (!result.valid || !result.snapshot) return null;

  return boardDocsFromSnapshot(boards, result.snapshot, seatId, move);
}
