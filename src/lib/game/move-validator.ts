import { Chess, type Square } from "chess.js";
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

/** Legal destination squares for a piece on `fromSquare` (for move hints). */
export function getValidMoveSquares(
  fen: string,
  fromSquare: Square,
  seatColor: PlayerColor = "w"
): Square[] {
  const chess = new Chess(fen);
  if (chess.turn() !== seatColor) return [];

  const piece = chess.get(fromSquare);
  if (!piece || piece.color !== seatColor) return [];

  const moves = chess.moves({ square: fromSquare, verbose: true });
  const targets = new Set<Square>();
  for (const move of moves) {
    targets.add(move.to as Square);
  }
  return [...targets];
}

function findKingSquare(chess: Chess, color: PlayerColor): Square | null {
  const board = chess.board();
  const files = "abcdefgh";
  const ranks = "87654321";
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row]?.[col];
      if (piece?.type === "k" && piece.color === color) {
        return `${files[col]}${ranks[row]}` as Square;
      }
    }
  }
  return null;
}

export interface CheckHighlightState {
  inCheck: boolean;
  kingSquare: Square | null;
  attackerSquares: Square[];
}

/** When `seatColor` is the side to move and in check, return king + attacker squares. */
export function getCheckHighlightState(
  fen: string,
  seatColor: PlayerColor
): CheckHighlightState {
  const chess = new Chess(fen);
  if (chess.turn() !== seatColor || !chess.isCheck()) {
    return { inCheck: false, kingSquare: null, attackerSquares: [] };
  }

  const kingSquare = findKingSquare(chess, seatColor);
  const opponent: PlayerColor = seatColor === "w" ? "b" : "w";
  const attackerSquares =
    kingSquare != null ? (chess.attackers(kingSquare, opponent) as Square[]) : [];

  return { inCheck: true, kingSquare, attackerSquares };
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
