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
    let score = 0;
    if (move.captured) score += skill.captureWeight;
    if (move.san.includes("+")) score += skill.checkWeight;
    if (move.san.includes("#")) score += 2;
    if (move.san.includes("x")) score += 0.08;
    return { move, score };
  });

  scored.sort((a, b) => b.score - a.score);

  const topPool =
    skill.tier === "pawn" || skill.tier === "knight"
      ? scored.slice(0, Math.min(3, scored.length))
      : skill.tier === "bishop" || skill.tier === "rook"
        ? scored.slice(0, Math.min(2, scored.length))
        : scored.slice(0, 1);

  const pick = pickRandom(topPool)?.move ?? scored[0]!.move;
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
  seatColor: "w" | "b" = "w",
  skill?: BotSkillProfile
): { piece: PieceSymbol; square: Square } | null {
  const reserve = captured as PieceSymbol[];
  const pieces = [...new Set(reserve)] as PieceSymbol[];
  if (pieces.length === 0) return null;

  const orderedPieces = shuffle(pieces);
  const candidates: { piece: PieceSymbol; square: Square; score: number }[] = [];

  for (const piece of orderedPieces) {
    for (const square of allSquares()) {
      const result = validateDrop(fen, piece, square, seatColor, reserve);
      if (result.valid) {
        let score = 0;
        if (result.fen) {
          const after = new Chess(result.fen);
          if (after.isCheckmate()) score += 3;
          else if (after.isCheck()) score += (skill?.checkWeight ?? 0.3) * 2;
        }
        if (square[1] === "4" || square[1] === "5") score += 0.15;
        candidates.push({ piece, square, score });
      }
    }
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => b.score - a.score);
  const pool =
    skill && skill.tier !== "pawn"
      ? candidates.slice(0, Math.min(3, candidates.length))
      : candidates;
  const pick = pickRandom(pool) ?? candidates[0]!;
  return { piece: pick.piece, square: pick.square };
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
