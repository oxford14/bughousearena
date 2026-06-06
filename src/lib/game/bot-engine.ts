import { Chess } from "chess.js";
import type { Square } from "chess.js";
import type { BoardDocument } from "@/types/firestore";
import { getSeatColor, type BoardSeatId, type PieceSymbol } from "./bughouse-engine";
import { validateDrop } from "./move-validator";
import { isBotUid } from "./bots";
import type { BotSkillProfile } from "./ranks";

const CAPTURE_VALUE: Record<string, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};

function pickRandom<T>(items: T[]): T | null {
  if (items.length === 0) return null;
  return items[Math.floor(Math.random() * items.length)]!;
}

function pickWeightedMove(
  moves: ReturnType<Chess["moves"]>,
  skill: BotSkillProfile
): string | null {
  if (moves.length === 0) return null;

  if (Math.random() < skill.blunderChance) {
    const blunder = pickRandom(moves);
    return blunder ? `${blunder.from}${blunder.to}` : null;
  }

  const scored = moves.map((move) => {
    let score = Math.random() * 0.08;
    if (move.captured) {
      score +=
        skill.captureWeight * (CAPTURE_VALUE[move.captured] ?? 1);
    }
    if (move.san.includes("+")) score += skill.checkWeight;
    if (move.san.includes("#")) score += 1.5;
    return { move, score };
  });

  scored.sort((a, b) => b.score - a.score);

  const topCount =
    skill.tier === "pawn"
      ? 4
      : skill.tier === "knight"
        ? 3
        : skill.tier === "bishop"
          ? 2
          : 1;
  const top = scored.slice(0, Math.min(topCount, scored.length));
  const pick = pickRandom(top)?.move ?? scored[0]!.move;
  return `${pick.from}${pick.to}`;
}

export function chooseBotMove(fen: string, skill: BotSkillProfile): string | null {
  const chess = new Chess(fen);
  const moves = chess.moves({ verbose: true });
  return pickWeightedMove(moves, skill);
}

/** Fast drop picker — shuffled search, returns first valid drop (keeps bot loop responsive). */
export function chooseBotDrop(
  fen: string,
  captured: string[],
  seatColor: "w" | "b" = "w"
): { piece: PieceSymbol; square: Square } | null {
  const reserve = captured as PieceSymbol[];
  const pieces = [...new Set(reserve)] as PieceSymbol[];
  if (pieces.length === 0) return null;

  const orderedPieces = shuffle(pieces);
  const orderedSquares = shuffle(allSquares());

  for (const piece of orderedPieces) {
    for (const square of orderedSquares) {
      const result = validateDrop(fen, piece, square, seatColor, reserve);
      if (result.valid) {
        return { piece, square };
      }
    }
  }
  return null;
}

function allSquares(): Square[] {
  const files = "abcdefgh";
  const ranks = "12345678";
  const squares: Square[] = [];
  for (const f of files) {
    for (const r of ranks) {
      squares.push(`${f}${r}` as Square);
    }
  }
  return squares;
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

export function isBotBoardTurn(
  board: BoardDocument,
  occupantUid?: string
): boolean {
  const uid = occupantUid ?? board.playerUid;
  if (!isBotUid(uid) || board.isGameOver) return false;
  if (board.boardStatus && board.boardStatus !== "active") return false;
  const chess = new Chess(board.fen);
  const seatColor = getSeatColor(board.id as BoardSeatId);
  return chess.turn() === seatColor && !chess.isGameOver();
}

export function shouldBotDrop(board: BoardDocument, skill: BotSkillProfile): boolean {
  if (board.captured.length === 0) return false;
  return Math.random() < skill.dropChance;
}

export function botThinkDelayMs(skill: BotSkillProfile): number {
  return (
    skill.thinkMinMs +
    Math.floor(Math.random() * (skill.thinkMaxMs - skill.thinkMinMs))
  );
}

export function inferBotPromotion(
  fen: string,
  move: string,
  seatColor: "w" | "b"
): PieceSymbol | undefined {
  const board = new Chess(fen);
  const from = move.slice(0, 2) as Square;
  const to = move.slice(2, 4);
  const piece = board.get(from);
  if (!piece || piece.type !== "p") return undefined;
  if (seatColor === "w" && to === "8") return "q";
  if (seatColor === "b" && to === "1") return "q";
  return undefined;
}

/** Fallback when the scored pick fails validation on the server. */
export function chooseAnyLegalMove(fen: string, seatColor: "w" | "b"): string | null {
  const chess = new Chess(fen);
  const moves = chess.moves({ verbose: true });
  if (moves.length === 0) return null;
  const pick = pickRandom(moves);
  return pick ? `${pick.from}${pick.to}` : null;
}
