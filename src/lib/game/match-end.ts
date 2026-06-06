import type { BoardDocument, MatchDocument, MatchEndReason } from "@/types/firestore";
import {
  getPhysicalBoardLabel,
  PHYSICAL_BOARD_SEATS,
  type PhysicalBoardId,
} from "@/lib/game/bughouse-engine";

export function getPlayerTeam(match: MatchDocument, uid: string): 1 | 2 | null {
  const player = match.players.find((p) => p.uid === uid);
  return player?.team ?? null;
}

export function didPlayerWin(match: MatchDocument, uid: string): boolean | null {
  if (!match.winnerTeam) return null;
  const team = getPlayerTeam(match, uid);
  if (!team) return null;
  return team === match.winnerTeam;
}

export function inferMatchEndReason(
  match: MatchDocument,
  boards: BoardDocument[]
): MatchEndReason | null {
  if (match.endReason) return match.endReason;
  if (boards.some((b) => b.boardStatus === "checkmate")) return "checkmate";
  if (
    boards.some(
      (b) => (b.whiteClock ?? 300) <= 0 || (b.blackClock ?? 300) <= 0
    )
  ) {
    return "time_forfeit";
  }
  if (match.resignedByUid) return "resignation";
  return null;
}

function physicalBoardStatus(
  boards: BoardDocument[],
  physicalId: PhysicalBoardId
): "checkmate" | "stalemate" | "active" {
  for (const seatId of PHYSICAL_BOARD_SEATS[physicalId]) {
    const board = boards.find((b) => b.id === seatId);
    if (board?.boardStatus === "checkmate") return "checkmate";
    if (board?.boardStatus === "stalemate") return "stalemate";
  }
  return "active";
}

function physicalBoardClocksExpired(
  boards: BoardDocument[],
  physicalId: PhysicalBoardId
): boolean {
  const primary = boards.find((b) => b.id === PHYSICAL_BOARD_SEATS[physicalId][0]);
  if (!primary) return false;
  return (primary.whiteClock ?? 300) <= 0 || (primary.blackClock ?? 300) <= 0;
}

export type PhysicalBoardResultStatus =
  | "checkmate"
  | "stalemate"
  | "time_forfeit"
  | "active";

/** End-of-match status for one physical board (A or B). */
export function getPhysicalBoardResultStatus(
  match: MatchDocument,
  boards: BoardDocument[],
  physicalId: PhysicalBoardId
): PhysicalBoardResultStatus {
  const playStatus = physicalBoardStatus(boards, physicalId);
  if (playStatus !== "active") return playStatus;

  if (
    inferMatchEndReason(match, boards) === "time_forfeit" &&
    physicalBoardClocksExpired(boards, physicalId)
  ) {
    return "time_forfeit";
  }

  return "active";
}

/** Physical board where the match-ending event occurred, if known. */
export function getDecisiveBoardLabel(
  match: MatchDocument,
  boards: BoardDocument[]
): string | null {
  const reason = inferMatchEndReason(match, boards);
  if (!reason) return null;

  if (reason === "checkmate") {
    for (const physicalId of ["alpha", "bravo"] as PhysicalBoardId[]) {
      if (physicalBoardStatus(boards, physicalId) === "checkmate") {
        return getPhysicalBoardLabel(physicalId);
      }
    }
  }

  if (reason === "time_forfeit") {
    for (const physicalId of ["alpha", "bravo"] as PhysicalBoardId[]) {
      if (physicalBoardClocksExpired(boards, physicalId)) {
        return getPhysicalBoardLabel(physicalId);
      }
    }
  }

  return null;
}

export function getMatchEndReasonTitle(
  match: MatchDocument,
  boards: BoardDocument[]
): string {
  const reason = inferMatchEndReason(match, boards);
  switch (reason) {
    case "checkmate":
      return "Checkmate";
    case "time_forfeit":
      return "Time forfeit";
    case "resignation":
      return "Resignation";
    default:
      return "Match complete";
  }
}

export function formatMatchEndReason(
  match: MatchDocument,
  viewerUid?: string,
  boards: BoardDocument[] = []
): string {
  const reason = inferMatchEndReason(match, boards);
  const decisiveBoard = getDecisiveBoardLabel(match, boards);

  if (reason === "resignation") {
    if (match.resignedByUid === viewerUid) {
      return "You resigned — your team forfeited the match.";
    }
    const resigner = match.players.find((p) => p.uid === match.resignedByUid);
    if (resigner) {
      return `${resigner.displayName} resigned.`;
    }
    return "Match ended by resignation.";
  }
  if (reason === "time_forfeit") {
    return decisiveBoard
      ? `A player ran out of time on ${decisiveBoard}.`
      : "A player ran out of time.";
  }
  if (reason === "checkmate") {
    return decisiveBoard
      ? `Checkmate on ${decisiveBoard}.`
      : "Checkmate ended the match.";
  }
  return "Match complete";
}

export function matchDurationSeconds(match: MatchDocument): number | null {
  const start = match.startedAt?.toMillis?.();
  const end = match.completedAt?.toMillis?.();
  if (start == null || end == null) return null;
  return Math.max(0, Math.round((end - start) / 1000));
}

export function formatDuration(seconds: number | null): string {
  if (seconds == null) return "—";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

export { type MatchEndReason };
