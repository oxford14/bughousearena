"use client";

import { useEffect, useRef } from "react";
import type { BoardDocument, MatchDocument, MatchPlayer } from "@/types/firestore";
import { getBotSkillForMember, isBotUid } from "@/lib/game/bots";
import {
  botThinkDelayMs,
  chooseBotDrop,
  chooseBotMove,
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

function findBotPlayer(
  players: MatchPlayer[],
  board: BoardDocument
): MatchPlayer | undefined {
  return players.find((p) => p.uid === board.playerUid);
}

/** Human client drives all bot moves (teammates and opponents) in bot-filled matches. */
export function useBotController({
  match,
  boards,
  humanUid,
}: UseBotControllerOptions) {
  const boardsRef = useRef(boards);
  const matchRef = useRef(match);
  const pendingRef = useRef<Set<string>>(new Set());
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  boardsRef.current = boards;
  matchRef.current = match;

  useEffect(() => {
    return () => {
      for (const timer of timersRef.current.values()) clearTimeout(timer);
      timersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (match.status !== "active") return;
    if (!humanUid) return;

    const botCount =
      match.botUids?.length ??
      match.players.filter((p) => p.isBot || isBotUid(p.uid)).length;
    const hasBots = match.hasBots ?? botCount > 0;
    if (!hasBots) return;
    if (!match.playerUids?.includes(humanUid)) return;

    const scheduleBotMoves = () => {
      const liveMatch = matchRef.current;
      const liveBoards = boardsRef.current;

      for (const board of liveBoards) {
        if (!isBotUid(board.playerUid)) continue;

        if (!isBotBoardTurn(board)) {
          const timer = timersRef.current.get(board.id);
          if (timer) {
            clearTimeout(timer);
            timersRef.current.delete(board.id);
          }
          pendingRef.current.delete(board.id);
          continue;
        }

        if (pendingRef.current.has(board.id)) continue;
        if (timersRef.current.has(board.id)) continue;

        const botPlayer = findBotPlayer(liveMatch.players, board);
        const skill = getBotSkillForMember(botPlayer ?? { rating: 1200 });
        const delay = botThinkDelayMs(skill);
        const boardId = board.id;

        pendingRef.current.add(boardId);

        const timer = setTimeout(() => {
          timersRef.current.delete(boardId);
          void executeBotTurn(liveMatch.id, boardId, skill, () =>
            boardsRef.current.find((b) => b.id === boardId)
          )
            .catch((err) => {
              console.warn("[bot] move failed", boardId, err);
            })
            .finally(() => {
              pendingRef.current.delete(boardId);
            });
        }, delay);

        timersRef.current.set(boardId, timer);
      }
    };

    scheduleBotMoves();
    const interval = setInterval(scheduleBotMoves, POLL_MS);
    return () => clearInterval(interval);
  }, [boards, humanUid, match.hasBots, match.id, match.playerUids, match.status]);
}

async function executeBotTurn(
  matchId: string,
  boardId: string,
  skill: ReturnType<typeof getBotSkillForMember>,
  getBoard: () => BoardDocument | undefined
) {
  const board = getBoard();
  if (!board) throw new Error("Board not found");
  if (!isBotBoardTurn(board)) throw new Error("Not bot turn");

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
          board.playerUid,
          `drop:${drop.piece}@${drop.square}`
        );
        return;
      }
    }
  }

  const move = chooseBotMove(board.fen, skill);
  if (!move) throw new Error("No legal move found");

  const validation = validateMove(board.fen, move, seatColor);
  if (!validation.valid) {
    throw new Error(validation.error ?? "Invalid bot move");
  }

  await submitMove(matchId, boardId, board.playerUid, move);
}
