import type { BoardDocument, MatchPlayer } from "@/types/firestore";
import {
  BOARD_IDS,
  getInitialFen,
  getPhysicalBoard,
  getSeatColor,
  SEAT_CONFIG,
  type BoardId,
} from "./bughouse-engine";

const INITIAL_CLOCK = 300;

export function createInitialBoards(players: MatchPlayer[]): BoardDocument[] {
  const alphaFen = getInitialFen();
  const bravoFen = getInitialFen();

  return BOARD_IDS.map((boardId) => {
    const player = players.find((p) => p.boardId === boardId) ?? players[BOARD_IDS.indexOf(boardId)];
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
      whiteClock: INITIAL_CLOCK,
      blackClock: INITIAL_CLOCK,
      isCheck: false,
      isGameOver: false,
    };
  });
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

export function assignPlayersToBoards(
  players: MatchPlayer[]
): MatchPlayer[] {
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
