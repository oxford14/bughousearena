import { Chess, type Square } from "chess.js";
import type { PieceSymbol } from "@/lib/game/bughouse-engine";

export const PROMOTION_CHOICES: {
  piece: PieceSymbol;
  label: string;
}[] = [
  { piece: "q", label: "Queen" },
  { piece: "r", label: "Rook" },
  { piece: "b", label: "Bishop" },
  { piece: "n", label: "Knight" },
];

/** True when moving a pawn to the last rank (needs a promotion choice). */
export function needsPawnPromotion(
  fen: string,
  from: string,
  to: string,
  seatColor: "w" | "b"
): boolean {
  try {
    const chess = new Chess(fen);
    if (chess.turn() !== seatColor) return false;
    const piece = chess.get(from as Square);
    if (!piece || piece.type !== "p" || piece.color !== seatColor) return false;
    const rank = to[1];
    if (seatColor === "w" && rank !== "8") return false;
    if (seatColor === "b" && rank !== "1") return false;
    // Must be a legal destination (with some promotion piece).
    const legal = chess
      .moves({ square: from as Square, verbose: true })
      .some((m) => m.to === to && Boolean(m.promotion));
    return legal;
  } catch {
    return false;
  }
}

export type PendingPromotion = {
  boardId: string;
  from: string;
  to: string;
  seatColor: "w" | "b";
};
