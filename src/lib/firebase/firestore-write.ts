import type { MatchPlayer } from "@/types/firestore";
import type { BoardDocument } from "@/types/firestore";

/** Firestore rejects undefined field values — strip optional fields for writes. */
export function serializeMatchPlayer(player: MatchPlayer): Record<string, unknown> {
  const doc: Record<string, unknown> = {
    uid: player.uid,
    displayName: player.displayName,
    photoURL: player.photoURL,
    boardId: player.boardId,
    team: player.team,
    rating: player.rating,
  };
  if (player.isBot === true) {
    doc.isBot = true;
    if (player.botSkill != null) doc.botSkill = player.botSkill;
    if (player.rankTier != null) doc.rankTier = player.rankTier;
  }
  if (player.playerColor != null) doc.playerColor = player.playerColor;
  return doc;
}

export function serializeBoard(board: BoardDocument): Record<string, unknown> {
  const doc: Record<string, unknown> = {
    id: board.id,
    fen: board.fen,
    captured: board.captured,
    turn: board.turn,
    lastMove: board.lastMove,
    playerUid: board.playerUid,
    partnerBoardId: board.partnerBoardId,
    team: board.team,
    isCheck: board.isCheck,
    isGameOver: board.isGameOver,
  };
  if (board.playerColor != null) {
    doc.playerColor = board.playerColor;
  }
  if (board.promotedSquares != null) {
    doc.promotedSquares = board.promotedSquares;
  }
  if (board.boardStatus != null) {
    doc.boardStatus = board.boardStatus;
  }
  if (board.whiteClock != null) {
    doc.whiteClock = board.whiteClock;
  }
  if (board.blackClock != null) {
    doc.blackClock = board.blackClock;
  }
  if (board.clockRunning !== undefined) {
    doc.clockRunning = board.clockRunning;
  }
  if (board.clockUpdatedAtMs != null) {
    doc.clockUpdatedAtMs = board.clockUpdatedAtMs;
  }
  return doc;
}
