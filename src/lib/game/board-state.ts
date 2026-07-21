import type { BoardDocument, ChessGameType, MatchPlayer } from "@/types/firestore";
import {
  BOARD_IDS,
  getInitialFen,
  getPhysicalBoard,
  getSeatColor,
  SEAT_CONFIG,
  type BoardId,
} from "./bughouse-engine";
import {
  getStandardInitialFen,
  SINGLE_BOARD_ID,
} from "./single-board-engine";
import { normalizeGameType } from "./game-types";

const INITIAL_CLOCK = 300;

export function createInitialBoards(
  players: MatchPlayer[],
  initialClockSec = INITIAL_CLOCK
): BoardDocument[] {
  const alphaFen = getInitialFen();
  const bravoFen = getInitialFen();

  return BOARD_IDS.map((boardId) => {
    const player =
      players.find((p) => p.boardId === boardId) ??
      players[BOARD_IDS.indexOf(boardId)];
    const config = SEAT_CONFIG[boardId];
    const physical = getPhysicalBoard(boardId);
    const fen = physical === "alpha" ? alphaFen : bravoFen;

    return {
      id: boardId,
      fen,
      captured: [],
      turn: "w",
      lastMove: null,
      playerUid: player?.uid ?? "",
      partnerBoardId: config.partnerBoardId,
      team: config.team,
      playerColor: player?.playerColor ?? getSeatColor(boardId),
      promotedSquares: [],
      boardStatus: "active",
      whiteClock: initialClockSec,
      blackClock: initialClockSec,
      isCheck: false,
      isGameOver: false,
    };
  });
}

/** Create boards for any chess game type (1 board for 1v1, 4 seats for bughouse). */
export function createInitialBoardsForGameType(
  players: MatchPlayer[],
  gameType: ChessGameType | undefined,
  initialClockSec = INITIAL_CLOCK
): BoardDocument[] {
  const type = normalizeGameType(gameType);
  if (type === "bughouse") {
    return createInitialBoards(players, initialClockSec);
  }

  const white =
    players.find((p) => p.playerColor === "w" || p.team === 1) ?? players[0];

  return [
    {
      id: SINGLE_BOARD_ID,
      fen: getStandardInitialFen(),
      captured: [],
      turn: "w",
      lastMove: null,
      playerUid: white?.uid ?? "",
      partnerBoardId: "",
      team: 1,
      playerColor: "w",
      promotedSquares: [],
      boardStatus: "active",
      whiteClock: initialClockSec,
      blackClock: initialClockSec,
      clockRunning: null,
      isCheck: false,
      isGameOver: false,
    },
  ];
}

export function getPlayerBoard(
  boards: BoardDocument[],
  uid: string
): BoardDocument | undefined {
  return boards.find((b) => b.playerUid === uid);
}

export function getPartnerBoard(
  boards: BoardDocument[],
  boardId: BoardId
): BoardDocument | undefined {
  const partnerId = SEAT_CONFIG[boardId].partnerBoardId;
  return boards.find((b) => b.id === partnerId);
}

export function getTeamBoards(
  boards: BoardDocument[],
  team: 1 | 2
): BoardDocument[] {
  return boards.filter((b) => b.team === team);
}

export function assignPlayersToBoards(players: MatchPlayer[]): MatchPlayer[] {
  return BOARD_IDS.map((boardId, index) => {
    const player = players[index];
    return {
      ...player,
      boardId,
      team: SEAT_CONFIG[boardId].team,
      playerColor: getSeatColor(boardId),
    };
  });
}

/** Seat two players for 1v1: white team1 on main, black team2 on main. */
export function assignTwoPlayersToSingleBoard(
  players: MatchPlayer[]
): MatchPlayer[] {
  if (players.length !== 2) {
    throw new Error(`Expected 2 players, got ${players.length}`);
  }
  const shuffled = [...players].sort(() => Math.random() - 0.5);
  return [
    {
      ...shuffled[0]!,
      boardId: SINGLE_BOARD_ID,
      team: 1,
      playerColor: "w",
    },
    {
      ...shuffled[1]!,
      boardId: SINGLE_BOARD_ID,
      team: 2,
      playerColor: "b",
    },
  ];
}
