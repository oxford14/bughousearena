import type { Square } from "chess.js";
import {
  applyAction,
  getSeatColor,
  getValidDropSquares as engineValidDrops,
  snapshotFromBoardDocs,
  validateDrop as engineValidateDrop,
  validateMove as engineValidateMove,
  type BoardSeatId,
  type BughouseSnapshot,
  type GameAction,
  type PieceSymbol,
  type PlayerColor,
} from "./bughouse-engine";

export type { PieceSymbol };

export function getValidDropSquares(
  fen: string,
  piece: PieceSymbol,
  seatColor: PlayerColor = "w",
  reserve: PieceSymbol[] = [piece]
): Square[] {
  const all = engineValidDrops(fen, reserve, seatColor);
  return all.filter((sq) => {
    const result = engineValidateDrop(fen, piece, sq, seatColor, reserve);
    return result.valid;
  });
}

export interface MoveValidationResult {
  valid: boolean;
  error?: string;
  fen?: string;
  capturedPiece?: PieceSymbol;
}

export function validateMove(
  fen: string,
  move: string,
  seatColor: PlayerColor = "w",
  promotion?: PieceSymbol
): MoveValidationResult {
  return engineValidateMove(fen, move, seatColor, promotion);
}

export function validateDrop(
  fen: string,
  piece: PieceSymbol,
  square: Square,
  seatColor: PlayerColor = "w",
  reserve: PieceSymbol[] = []
): MoveValidationResult {
  return engineValidateDrop(fen, piece, square, seatColor, reserve);
}

export function validateGameAction(
  snapshot: BughouseSnapshot,
  action: GameAction
) {
  return applyAction(snapshot, action);
}

export function buildSnapshotFromBoards(
  boards: Parameters<typeof snapshotFromBoardDocs>[0]
) {
  return snapshotFromBoardDocs(boards);
}

export function getSeatColorForBoard(boardId: string, fallback?: PlayerColor): PlayerColor {
  if (boardId in { "board-a": 1, "board-b": 1, "board-c": 1, "board-d": 1 }) {
    return getSeatColor(boardId as BoardSeatId);
  }
  return fallback ?? "w";
}
