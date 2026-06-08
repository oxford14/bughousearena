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
import {
  resolvePlayingColor,
  type BoardSeatId,
  type PieceSymbol,
} from "@/lib/game/bughouse-engine";
import { validateDrop, validateMove } from "@/lib/game/move-validator";
import { submitBotMoveViaApi } from "@/lib/game/bot-move-api";
import { submitMove } from "@/lib/game/matchmaking";

interface UseBotControllerOptions {
  match: MatchDocument;
  boards: BoardDocument[];
  humanUid: string | undefined;
}

const POLL_MS = 500;
const MAX_SUBMIT_ATTEMPTS = 6;
const MAX_BOT_STEPS_PER_TICK = 4;

function matchHasBots(match: MatchDocument): boolean {
  if (match.hasBots) return true;
  if ((match.botUids?.length ?? 0) > 0) return true;
  return match.players.some((p) => p.isBot || isBotUid(p.uid));
}

function isHumanParticipant(match: MatchDocument, humanUid: string): boolean {
  if (match.playerUids?.includes(humanUid)) return true;
  return match.players.some((p) => p.uid === humanUid && !p.isBot && !isBotUid(p.uid));
}

function listBots(match: MatchDocument): MatchPlayer[] {
  return match.players.filter((p) => p.isBot || isBotUid(p.uid));
}

/** Occupant board doc — playerUid is authoritative after color-setup seat swaps. */
function boardForBot(bot: MatchPlayer, boards: BoardDocument[]): BoardDocument | undefined {
  return (
    boards.find((b) => b.playerUid === bot.uid) ??
    boards.find((b) => b.id === bot.boardId)
  );
}

function botPlayingColor(bot: MatchPlayer, board: BoardDocument): "w" | "b" {
  return resolvePlayingColor(board.id as BoardSeatId, bot, board);
}

function findBotBoardToMove(
  match: MatchDocument,
  boards: BoardDocument[]
): { board: BoardDocument; bot: MatchPlayer } | null {
  for (const bot of listBots(match)) {
    const board = boardForBot(bot, boards);
    if (!board) continue;
    const color = botPlayingColor(bot, board);
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
    if (!matchHasBots(match)) return;
    if (!isHumanParticipant(match, humanUid)) return;

    const runBotStep = async () => {
      if (processingRef.current || cancelledRef.current) return;

      processingRef.current = true;

      try {
        for (let step = 0; step < MAX_BOT_STEPS_PER_TICK; step++) {
          if (cancelledRef.current) return;

          const liveMatch = matchRef.current;
          const liveBoards = boardsRef.current;
          const next = findBotBoardToMove(liveMatch, liveBoards);
          if (!next) break;

          const { board: botBoard, bot } = next;
          const skill = getBotSkillForMember(bot);
          const seatColor = botPlayingColor(bot, botBoard);

          await new Promise((resolve) => setTimeout(resolve, botThinkDelayMs(skill)));
          if (cancelledRef.current) return;

          const freshBoard = boardForBot(bot, boardsRef.current);
          if (
            !freshBoard ||
            freshBoard.id !== botBoard.id ||
            !isBotBoardTurn(freshBoard, bot.uid, seatColor)
          ) {
            continue;
          }

          await executeBotTurn(
            liveMatch.id,
            freshBoard.id,
            bot.uid,
            seatColor,
            skill,
            () => boardForBot(bot, boardsRef.current)
          );
        }
      } catch (err) {
        console.warn("[bot] move loop failed", err);
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
  }, [boardsSignature, humanUid, match, match.id, match.status]);
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
  try {
    await submitBotMoveViaApi(matchId, boardId, playerId, move, promotion);
  } catch (apiError) {
    console.warn("[bot] API move failed, trying client submit", apiError);
    await submitMove(matchId, boardId, playerId, move, undefined, undefined, promotion);
  }
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
        await submitBotMove(
          matchId,
          boardId,
          playerId,
          `drop:${drop.piece}@${drop.square}`,
          board.fen,
          seatColor
        );
        return;
      }
    }
  }

  const candidates: string[] = [];
  const primary = chooseBotMove(board.fen, skill, seatColor);
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
