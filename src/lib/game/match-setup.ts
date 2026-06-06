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

/** Each team holds one white seat and one black seat (opposite physical boards). */
const TEAM_SEAT_BY_COLOR: Record<1 | 2, Record<PlayerColor, BoardId>> = {
  1: { w: "board-a", b: "board-d" },
  2: { w: "board-b", b: "board-c" },
};

export function teamSeatForColor(team: 1 | 2, color: PlayerColor): BoardId {
  return TEAM_SEAT_BY_COLOR[team][color];
}

/**
 * Pending color shown in the picker:
 * - your own choice if you made one
 * - the opposite of your partner's choice if only they picked
 * - undecided otherwise
 */
export function previewTeamAssignment(
  teammates: MatchPlayer[],
  choices: Record<string, PlayerColor | undefined>,
  myUid: string
): PlayerColor | null {
  const mine = teammates.find((p) => p.uid === myUid);
  if (!mine) return null;

  const myChoice = choices[myUid];
  if (myChoice) return myChoice;

  const partner = teammates.find((p) => p.uid !== myUid);
  if (partner && choices[partner.uid]) {
    return oppositeColor(choices[partner.uid]!);
  }
  return null;
}

/**
 * Final seating that honors color choices. Within each team the two players are
 * placed on the seat matching their resolved color (swapping physical boards as
 * needed), so a player who picks black is seated on their team's black board.
 */
export function resolveTeamSeating(
  players: MatchPlayer[],
  choices: Record<string, PlayerColor | undefined>
): MatchPlayer[] {
  const seatedByUid = new Map<string, MatchPlayer>();

  for (const team of [1, 2] as const) {
    const teammates = players.filter((p) => p.team === team);

    if (teammates.length === 2) {
      const [pA, pB] = teammates as [MatchPlayer, MatchPlayer];
      const { a, b } = resolveTeamColors(pA, pB, choices);
      seatedByUid.set(pA.uid, {
        ...pA,
        boardId: teamSeatForColor(team, a),
        playerColor: a,
      });
      seatedByUid.set(pB.uid, {
        ...pB,
        boardId: teamSeatForColor(team, b),
        playerColor: b,
      });
    } else {
      for (const p of teammates) {
        const color =
          choices[p.uid] ??
          (p.boardId ? getSeatColor(p.boardId as BoardId) : "w");
        seatedByUid.set(p.uid, {
          ...p,
          boardId: teamSeatForColor(team, color),
          playerColor: color,
        });
      }
    }
  }

  return players.map((p) => seatedByUid.get(p.uid) ?? p);
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
