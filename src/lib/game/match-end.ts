import type { MatchDocument, MatchEndReason } from "@/types/firestore";

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

export function formatMatchEndReason(
  match: MatchDocument,
  viewerUid?: string
): string {
  const reason = match.endReason;
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
  if (reason === "time_forfeit") return "Time forfeit";
  if (reason === "checkmate") return "Checkmate";
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
