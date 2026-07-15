import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { assignPlayersFromUnits } from "@/lib/game/team-builder";
import { createInitialBoards } from "@/lib/game/board-state";
import { serializeBoard, serializeMatchPlayer } from "@/lib/firebase/firestore-write";
import type { MatchPlayer } from "@/types/firestore";
import { STANDARD_TIME_CONTROL_SEC } from "@/lib/game/time-control";

const SETUP_DURATION_SEC = 60;

export async function createMatchAdmin(
  db: Firestore,
  opts: {
    mode: "casual" | "ranked" | "private" | "stake";
    players: MatchPlayer[];
    timeControlSec?: number;
    stakePerPlayer?: number;
    tournamentId?: string;
    tournamentBracketMatchId?: string;
    tournamentTeam1Id?: string;
    tournamentTeam2Id?: string;
  }
): Promise<string> {
  const timeControlSec = opts.timeControlSec ?? STANDARD_TIME_CONTROL_SEC;
  const humanUids = opts.players.filter((p) => !p.isBot).map((p) => p.uid);
  const botUids = opts.players.filter((p) => p.isBot).map((p) => p.uid);

  const matchRef = db.collection("matches").doc();
  const setupEndsAt = new Date(Date.now() + SETUP_DURATION_SEC * 1000);

  await db.runTransaction(async (tx) => {
    tx.set(matchRef, {
      mode: opts.mode,
      status: "setup",
      players: opts.players.map(serializeMatchPlayer),
      playerUids: humanUids,
      botUids,
      hasBots: botUids.length > 0,
      colorChoices: {},
      setupEndsAt,
      teamClocks: { team1: timeControlSec, team2: timeControlSec },
      timeControl: timeControlSec,
      winnerTeam: null,
      createdAt: FieldValue.serverTimestamp(),
      startedAt: null,
      completedAt: null,
      ...(opts.stakePerPlayer ? { stakePerPlayer: opts.stakePerPlayer } : {}),
      ...(opts.tournamentId ? { tournamentId: opts.tournamentId } : {}),
      ...(opts.tournamentBracketMatchId
        ? { tournamentBracketMatchId: opts.tournamentBracketMatchId }
        : {}),
      ...(opts.tournamentTeam1Id ? { tournamentTeam1Id: opts.tournamentTeam1Id } : {}),
      ...(opts.tournamentTeam2Id ? { tournamentTeam2Id: opts.tournamentTeam2Id } : {}),
    });

    for (const board of createInitialBoards(opts.players, timeControlSec)) {
      tx.set(
        matchRef.collection("boards").doc(board.id),
        serializeBoard(board)
      );
    }

    for (const uid of humanUids) {
      tx.set(db.collection("users").doc(uid).collection("session").doc("active"), {
        matchId: matchRef.id,
        mode: opts.mode,
        createdAt: FieldValue.serverTimestamp(),
      });
    }
  });

  return matchRef.id;
}

export function buildPlayersFromTeams(
  team1Members: Array<{
    uid: string;
    displayName: string;
    photoURL: string | null;
    rating: number;
  }>,
  team2Members: Array<{
    uid: string;
    displayName: string;
    photoURL: string | null;
    rating: number;
  }>
): MatchPlayer[] {
  const units = [team1Members, team2Members];
  const assigned = assignPlayersFromUnits(units);
  return assigned.map((p) => ({
    uid: p.uid,
    displayName: p.displayName,
    photoURL: p.photoURL,
    boardId: p.boardId,
    team: p.team,
    rating: p.rating,
  }));
}
