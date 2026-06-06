import type { MatchPlayer, PlayerColor } from "@/types/firestore";
import { getSeatColor, type BoardId } from "./bughouse-engine";

export const MATCH_SETUP_DURATION_SEC = 15;

export const OPPONENT_BOARD_PAIRS: [BoardId, BoardId][] = [
  ["board-a", "board-c"],
  ["board-b", "board-d"],
];

export function oppositeColor(color: PlayerColor): PlayerColor {
  return color === "w" ? "b" : "w";
}

function pickRandomColor(): PlayerColor {
  return Math.random() < 0.5 ? "w" : "b";
}

/** Resolve white/black within a team of two from their color choices. */
export function resolveTeamColors(
  playerA: MatchPlayer,
  playerB: MatchPlayer,
  choices: Record<string, PlayerColor | undefined>
): { a: PlayerColor; b: PlayerColor } {
  const choiceA = choices[playerA.uid];
  const choiceB = choices[playerB.uid];

  if (choiceA && !choiceB) {
    return { a: choiceA, b: oppositeColor(choiceA) };
  }
  if (!choiceA && choiceB) {
    return { a: oppositeColor(choiceB), b: choiceB };
  }
  if (choiceA && choiceB) {
    if (choiceA !== choiceB) {
      return { a: choiceA, b: choiceB };
    }
    const first = pickRandomColor();
    return { a: first, b: oppositeColor(first) };
  }

  const first = pickRandomColor();
  return { a: first, b: oppositeColor(first) };
}

export function previewTeamAssignment(
  teammates: MatchPlayer[],
  _choices: Record<string, PlayerColor | undefined>,
  myUid: string
): PlayerColor | null {
  const mine = teammates.find((p) => p.uid === myUid);
  if (!mine?.boardId) return null;
  return getSeatColor(mine.boardId as BoardId);
}

/** Seat colors are fixed per board in Bughouse (White Alpha, Black Bravo, etc.). */
export function resolveMatchColors(
  players: MatchPlayer[],
  _choices: Record<string, PlayerColor | undefined>
): Record<string, PlayerColor> {
  const colors: Record<string, PlayerColor> = {};
  for (const player of players) {
    if (!player.boardId) continue;
    colors[player.uid] = getSeatColor(player.boardId as BoardId);
  }
  return colors;
}

export function getSetupSecondsRemaining(setupEndsAtMs: number, nowMs = Date.now()): number {
  return Math.max(0, Math.ceil((setupEndsAtMs - nowMs) / 1000));
}

/** One row per teammate — guards against duplicate uids in match.players. */
export function getTeamPlayers(players: MatchPlayer[], team: 1 | 2): MatchPlayer[] {
  const seen = new Set<string>();
  return players.filter((p) => {
    if (p.team !== team) return false;
    if (seen.has(p.uid)) return false;
    seen.add(p.uid);
    return true;
  });
}

/** Keep the first seat assignment when match.players lists the same uid twice. */
export function dedupePlayersByUid(players: MatchPlayer[]): MatchPlayer[] {
  const seen = new Set<string>();
  return players.filter((p) => {
    if (seen.has(p.uid)) return false;
    seen.add(p.uid);
    return true;
  });
}
