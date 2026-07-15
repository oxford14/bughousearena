import type { BoardDocument, MatchDocument } from "@/types/firestore";

function boardSnapshotKey(board: BoardDocument): string {
  return [
    board.id,
    board.fen,
    board.turn,
    board.captured.join(","),
    board.lastMove ?? "",
    board.boardStatus ?? "",
    board.whiteClock ?? "",
    board.blackClock ?? "",
    board.clockRunning ?? "",
    board.clockUpdatedAtMs ?? "",
    board.isCheck,
    board.isGameOver,
  ].join(":");
}

export function boardsSnapshotKey(boards: BoardDocument[]): string {
  return boards
    .map(boardSnapshotKey)
    .sort((a, b) => a.localeCompare(b))
    .join("|");
}

export function matchSnapshotKey(match: MatchDocument): string {
  return [
    match.id,
    match.status,
    match.mode,
    match.clocksStartedAtMs ?? "",
    match.startedAt?.toMillis?.() ?? match.startedAt ?? "",
    match.winnerTeam ?? "",
    match.endReason ?? "",
    match.players
      .map(
        (p) =>
          `${p.uid}:${p.boardId}:${p.team}:${p.rating}:${p.displayName}:${p.isBot ?? false}`
      )
      .join(","),
  ].join("|");
}
