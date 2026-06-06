import { Chess } from "chess.js";
import type { Square } from "chess.js";
import type { BoardDocument } from "@/types/firestore";
import { getSeatColor, type BoardSeatId, type PieceSymbol } from "./bughouse-engine";
import { validateDrop } from "./move-validator";
import { isBotUid } from "./bots";
import type { BotSkillProfile } from "./ranks";

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
    let score = Math.random() * 0.15;
    if (move.captured) score += skill.captureWeight;
    if (move.san.includes("+")) score += skill.checkWeight;
    if (move.san.includes("#")) score += 1.5;
    return { move, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, Math.min(3, scored.length));
  const pick = pickRandom(top)?.move ?? scored[0]!.move;
  return `${pick.from}${pick.to}`;
}

export function chooseBotMove(fen: string, skill: BotSkillProfile): string | null {
  const chess = new Chess(fen);
  const moves = chess.moves({ verbose: true });
  return pickWeightedMove(moves, skill);
}

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

export function isBotBoardTurn(board: BoardDocument): boolean {
  if (!isBotUid(board.playerUid) || board.isGameOver) return false;
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
