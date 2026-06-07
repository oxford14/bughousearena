"use client";

import { useEffect, useMemo, useRef } from "react";
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

function botPlayingColor(bot: MatchPlayer, boardId: string): "w" | "b" {
  return bot.playerColor ?? getSeatColor(boardId as BoardSeatId);
}

function findBotBoardToMove(
  match: MatchDocument,
  boards: BoardDocument[]
): { board: BoardDocument; bot: MatchPlayer } | null {
  for (const board of boards) {
    const bot = isBotSeat(match, board);
    if (!bot) continue;
    const color = botPlayingColor(bot, board.id);
    if (isBotBoardTurn(board, bot.uid, color)) {
      return { board, bot };
    }
  }
  return null;
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

  const boardsSignature = useMemo(
    () =>
      boards
        .map((b) => `${b.id}:${b.fen}:${b.lastMove ?? ""}:${b.boardStatus ?? "active"}`)
        .join("|"),
    [boards]
  );

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

    const runBotStep = async () => {
      if (processingRef.current || cancelledRef.current) return;

      const liveMatch = matchRef.current;
      const liveBoards = boardsRef.current;
      const next = findBotBoardToMove(liveMatch, liveBoards);
      if (!next) return;

      processingRef.current = true;
      const { board: botBoard, bot } = next;
      const skill = getBotSkillForMember(bot);
      const seatColor = botPlayingColor(bot, botBoard.id);

      try {
        await new Promise((resolve) => setTimeout(resolve, botThinkDelayMs(skill)));
        if (cancelledRef.current) return;

        const freshBoard = boardsRef.current.find((b) => b.id === botBoard.id);
        if (
          !freshBoard ||
          !isBotBoardTurn(freshBoard, bot.uid, seatColor)
        ) {
          return;
        }

        await executeBotTurn(
          liveMatch.id,
          botBoard.id,
          bot.uid,
          seatColor,
          skill,
          () => boardsRef.current.find((b) => b.id === botBoard.id)
        );
      } catch (err) {
        console.warn("[bot] move failed", botBoard.id, err);
      } finally {
        processingRef.current = false;
      }
    };

    void runBotStep();
    const interval = setInterval(() => void runBotStep(), POLL_MS);

    return () => {
      cancelledRef.current = true;
      clearInterval(interval);
    };
  }, [
    boardsSignature,
    humanUid,
    match.hasBots,
    match.id,
    match.playerUids,
    match.status,
  ]);
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
  seatColor: "w" | "b",
  skill: ReturnType<typeof getBotSkillForMember>,
  getBoard: () => BoardDocument | undefined
) {
  const board = getBoard();
  if (!board) throw new Error("Board not found");
  if (!isBotBoardTurn(board, playerId, seatColor)) throw new Error("Not bot turn");

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
