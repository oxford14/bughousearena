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
import {
  getPhysicalBoard,
  resolvePlayingColor,
  type BoardSeatId,
  type PhysicalBoardId,
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

const POLL_MS = 400;
const MAX_SUBMIT_ATTEMPTS = 6;
const PARALLEL_THINK_CAP_MS = 400;
const PHYSICAL_BOARDS: PhysicalBoardId[] = ["alpha", "bravo"];

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

interface BotMoveTarget {
  board: BoardDocument;
  bot: MatchPlayer;
}

/**
 * One pending bot move per physical board (Alpha / Bravo).
 * Bughouse boards are independent — partner moves never gate local turns.
 */
function findBotsToMoveByPhysicalBoard(
  match: MatchDocument,
  boards: BoardDocument[]
): Partial<Record<PhysicalBoardId, BotMoveTarget>> {
  const pending: Partial<Record<PhysicalBoardId, BotMoveTarget>> = {};

  for (const bot of listBots(match)) {
    const board = boardForBot(bot, boards);
    if (!board) continue;

    const color = botPlayingColor(bot, board);
    if (!isBotBoardTurn(board, bot.uid, color)) continue;

    const physicalId = getPhysicalBoard(board.id as BoardSeatId);
    if (!pending[physicalId]) {
      pending[physicalId] = { board, bot };
    }
  }

  return pending;
}

/** Human client drives all bot moves (teammates and opponents) in bot-filled matches. */
export function useBotController({
  match,
  boards,
  humanUid,
}: UseBotControllerOptions) {
  const boardsRef = useRef(boards);
  const matchRef = useRef(match);
  const cancelledRef = useRef(false);
  const processingByPhysicalRef = useRef<Partial<Record<PhysicalBoardId, boolean>>>({});

  boardsRef.current = boards;
  matchRef.current = match;

  useEffect(() => {
    cancelledRef.current = false;
    processingByPhysicalRef.current = {};

    if (match.status !== "active") return;
    if (!humanUid) return;
    if (!matchHasBots(match)) return;
    if (!isHumanParticipant(match, humanUid)) return;

    const runBotOnPhysicalBoard = async (
      physicalId: PhysicalBoardId,
      target: BotMoveTarget,
      matchId: string,
      peerAlsoWaiting: boolean
    ) => {
      if (processingByPhysicalRef.current[physicalId]) return;
      processingByPhysicalRef.current[physicalId] = true;

      const { board: botBoard, bot } = target;
      const skill = getBotSkillForMember(bot);
      const seatColor = botPlayingColor(bot, botBoard);

      try {
        const thinkMs = peerAlsoWaiting
          ? Math.min(botThinkDelayMs(skill), PARALLEL_THINK_CAP_MS)
          : botThinkDelayMs(skill);

        await new Promise((resolve) => setTimeout(resolve, thinkMs));
        if (cancelledRef.current) return;

        const freshBoard = boardForBot(bot, boardsRef.current);
        if (
          !freshBoard ||
          freshBoard.id !== botBoard.id ||
          !isBotBoardTurn(freshBoard, bot.uid, seatColor)
        ) {
          return;
        }

        await executeBotTurn(
          matchId,
          freshBoard.id,
          bot.uid,
          seatColor,
          skill,
          () => boardForBot(bot, boardsRef.current)
        );
      } catch (err) {
        console.warn(`[bot] ${physicalId} move failed`, err);
      } finally {
        processingByPhysicalRef.current[physicalId] = false;
      }
    };

    const runBotStep = () => {
      if (cancelledRef.current) return;

      const liveMatch = matchRef.current;
      const liveBoards = boardsRef.current;
      const pending = findBotsToMoveByPhysicalBoard(liveMatch, liveBoards);
      const waitingIds = PHYSICAL_BOARDS.filter((id) => pending[id]);
      const peerAlsoWaiting = waitingIds.length > 1;

      for (const physicalId of waitingIds) {
        const target = pending[physicalId];
        if (!target) continue;
        void runBotOnPhysicalBoard(
          physicalId,
          target,
          liveMatch.id,
          peerAlsoWaiting
        );
      }
    };

    runBotStep();
    const interval = setInterval(runBotStep, POLL_MS);

    return () => {
      cancelledRef.current = true;
      clearInterval(interval);
    };
    // Stable interval — boards are read from boardsRef; restarting on every FEN
    // change cancelled in-flight moves and starved the human's physical board.
  }, [humanUid, match.id, match.status, match.hasBots, match.botUids?.length]);
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
