"use client";

import { useEffect, useRef } from "react";
import type { BoardDocument, MatchDocument, MatchPlayer } from "@/types/firestore";
import { getBotSkillForMember, isBotUid } from "@/lib/game/bots";
import {
  botThinkDelayMs,
  chooseAnyLegalMove,
  chooseBotDrop,
  chooseBotMove,
  inferBotPromotion,
  isBotBoardTurn,
  shouldBotDrop,
} from "@/lib/game/bot-engine";
import { getSeatColor, type BoardSeatId, type PieceSymbol } from "@/lib/game/bughouse-engine";
import { validateDrop, validateMove } from "@/lib/game/move-validator";
import { submitMove } from "@/lib/game/matchmaking";

interface UseBotControllerOptions {
  match: MatchDocument;
  boards: BoardDocument[];
  humanUid: string | undefined;
}

const POLL_MS = 750;
const RETRY_MS = 600;
const MAX_SUBMIT_ATTEMPTS = 6;

/** Prefer match.players seating — board.playerUid can lag after color-pick swaps. */
function getSeatOccupant(
  match: MatchDocument,
  board: BoardDocument
): MatchPlayer | undefined {
  return (
    match.players.find((p) => p.boardId === board.id) ??
    match.players.find((p) => p.uid === board.playerUid)
  );
}

function isBotSeat(
  match: MatchDocument,
  board: BoardDocument
): MatchPlayer | undefined {
  const occupant = getSeatOccupant(match, board);
  if (!occupant) return undefined;
  if (occupant.isBot || isBotUid(occupant.uid)) return occupant;
  return undefined;
}

/** Human client drives all bot moves (teammates and opponents) in bot-filled matches. */
export function useBotController({
  match,
  boards,
  humanUid,
}: UseBotControllerOptions) {
  const boardsRef = useRef(boards);
  const matchRef = useRef(match);
  const processingRef = useRef(false);
  const cancelledRef = useRef(false);

  boardsRef.current = boards;
  matchRef.current = match;

  useEffect(() => {
    cancelledRef.current = false;

    if (match.status !== "active") return;
    if (!humanUid) return;

    const botCount =
      match.botUids?.length ??
      match.players.filter((p) => p.isBot || isBotUid(p.uid)).length;
    const hasBots = match.hasBots ?? botCount > 0;
    if (!hasBots) return;
    if (!match.playerUids?.includes(humanUid)) return;

    const runBotLoop = async () => {
      if (processingRef.current || cancelledRef.current) return;
      processingRef.current = true;

      try {
        while (!cancelledRef.current) {
          const liveMatch = matchRef.current;
          const liveBoards = boardsRef.current;

          const botBoard = liveBoards.find((board) => {
            const bot = isBotSeat(liveMatch, board);
            if (!bot) return false;
            return isBotBoardTurn(board, bot.uid);
          });

          if (!botBoard) break;

          const bot = isBotSeat(liveMatch, botBoard)!;
          const skill = getBotSkillForMember(bot);
          await new Promise((resolve) =>
            setTimeout(resolve, botThinkDelayMs(skill))
          );
          if (cancelledRef.current) break;

          try {
            await executeBotTurn(
              liveMatch.id,
              botBoard.id,
              bot.uid,
              skill,
              () => boardsRef.current.find((b) => b.id === botBoard.id)
            );
          } catch (err) {
            console.warn("[bot] move failed", botBoard.id, err);
            await new Promise((resolve) => setTimeout(resolve, RETRY_MS));
          }
        }
      } finally {
        processingRef.current = false;
      }
    };

    void runBotLoop();
    const interval = setInterval(() => void runBotLoop(), POLL_MS);

    return () => {
      cancelledRef.current = true;
      clearInterval(interval);
    };
  }, [humanUid, match.hasBots, match.id, match.playerUids, match.status]);
}

async function submitBotMove(
  matchId: string,
  boardId: string,
  playerId: string,
  move: string,
  fen: string,
  seatColor: "w" | "b"
): Promise<void> {
  const promotion = inferBotPromotion(fen, move, seatColor);
  await submitMove(matchId, boardId, playerId, move, undefined, undefined, promotion);
}

async function executeBotTurn(
  matchId: string,
  boardId: string,
  playerId: string,
  skill: ReturnType<typeof getBotSkillForMember>,
  getBoard: () => BoardDocument | undefined
) {
  const board = getBoard();
  if (!board) throw new Error("Board not found");
  if (!isBotBoardTurn(board, playerId)) throw new Error("Not bot turn");

  const seatColor = getSeatColor(boardId as BoardSeatId);
  const reserve = board.captured as PieceSymbol[];

  if (shouldBotDrop(board, skill)) {
    const drop = chooseBotDrop(board.fen, board.captured, seatColor);
    if (drop) {
      const validation = validateDrop(
        board.fen,
        drop.piece,
        drop.square,
        seatColor,
        reserve
      );
      if (validation.valid) {
        await submitMove(
          matchId,
          boardId,
          playerId,
          `drop:${drop.piece}@${drop.square}`
        );
        return;
      }
    }
  }

  const candidates: string[] = [];
  const primary = chooseBotMove(board.fen, skill);
  if (primary) candidates.push(primary);

  const fallback = chooseAnyLegalMove(board.fen, seatColor);
  if (fallback && !candidates.includes(fallback)) {
    candidates.push(fallback);
  }

  if (candidates.length === 0) {
    throw new Error("No legal move found");
  }

  let lastError: unknown;
  for (const move of candidates.slice(0, MAX_SUBMIT_ATTEMPTS)) {
    const validation = validateMove(
      board.fen,
      move,
      seatColor,
      inferBotPromotion(board.fen, move, seatColor)
    );
    if (!validation.valid) continue;

    try {
      await submitBotMove(matchId, boardId, playerId, move, board.fen, seatColor);
      return;
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError ?? new Error("Could not submit bot move");
}
