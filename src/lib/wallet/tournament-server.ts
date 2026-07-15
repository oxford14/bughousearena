import { FieldValue, Timestamp, type Firestore } from "firebase-admin/firestore";
import { debitCoins, creditCoins, WalletError } from "@/lib/wallet/wallet-server";
import type { TournamentBracketMatch } from "@/types/wallet";
import {
  buildPlayersFromTeams,
  createMatchAdmin,
} from "@/lib/game/match-create-admin";

export const CHAMPION_REWARD_SPLIT = { champion: 0.7, runnerUp: 0.3 } as const;

export async function registerTournamentTeam(
  db: Firestore,
  tournamentId: string,
  player1Uid: string,
  player2Uid: string,
  teamName: string
): Promise<{ teamId: string }> {
  if (player1Uid === player2Uid) {
    throw new Error("Select a different partner.");
  }

  const tournamentRef = db.collection("tournaments").doc(tournamentId);
  const tournamentSnap = await tournamentRef.get();
  if (!tournamentSnap.exists) throw new Error("Tournament not found.");

  const tournament = tournamentSnap.data()!;
  if (tournament.status !== "registration") {
    throw new Error("Registration is closed.");
  }

  const fee = tournament.registrationFeeCoins as number;
  const maxTeams = tournament.maxTeams as number;
  const registered = (tournament.registeredTeamCount as number) ?? 0;
  if (registered >= maxTeams) {
    throw new Error("Tournament is full.");
  }

  const existingTeams = await tournamentRef.collection("teams").get();
  for (const doc of existingTeams.docs) {
    const t = doc.data();
    const uids = [t.player1Uid, t.player2Uid] as string[];
    if (uids.includes(player1Uid) || uids.includes(player2Uid)) {
      throw new Error("One or both players are already registered.");
    }
  }

  const [p1Snap, p2Snap] = await Promise.all([
    db.collection("users").doc(player1Uid).get(),
    db.collection("users").doc(player2Uid).get(),
  ]);
  if (!p1Snap.exists || !p2Snap.exists) {
    throw new Error("Player profile not found.");
  }

  const teamRef = tournamentRef.collection("teams").doc();

  try {
    await debitCoins(db, {
      uid: player1Uid,
      amount: -fee,
      type: "tournament_fee",
      refId: `${tournamentId}_${teamRef.id}_p1`,
      metadata: { tournamentId, teamId: teamRef.id },
    });
    await debitCoins(db, {
      uid: player2Uid,
      amount: -fee,
      type: "tournament_fee",
      refId: `${tournamentId}_${teamRef.id}_p2`,
      metadata: { tournamentId, teamId: teamRef.id },
    });
  } catch (error) {
    if (error instanceof WalletError) {
      throw new Error("One or both players lack enough coins for registration.");
    }
    throw error;
  }

  await teamRef.set({
    tournamentId,
    teamName: teamName.trim() || "Arena Team",
    player1Uid,
    player2Uid,
    player1DisplayName: p1Snap.data()!.displayName,
    player2DisplayName: p2Snap.data()!.displayName,
    registeredAt: FieldValue.serverTimestamp(),
  });

  const newReward = ((tournament.championRewardCoins as number) ?? 0) + fee * 2;
  await tournamentRef.update({
    registeredTeamCount: FieldValue.increment(1),
    championRewardCoins: newReward,
  });

  return { teamId: teamRef.id };
}

export function buildSingleEliminationBracket(
  teamIds: string[]
): TournamentBracketMatch[] {
  const padded = [...teamIds];
  while (padded.length < 8) padded.push("");
  const matches: TournamentBracketMatch[] = [];

  for (let i = 0; i < 4; i++) {
    matches.push({
      id: `r1_m${i}`,
      round: 1,
      matchIndex: i,
      team1Id: padded[i * 2] || null,
      team2Id: padded[i * 2 + 1] || null,
      matchId: null,
      winnerTeamId: null,
    });
  }
  for (let i = 0; i < 2; i++) {
    matches.push({
      id: `r2_m${i}`,
      round: 2,
      matchIndex: i,
      team1Id: null,
      team2Id: null,
      matchId: null,
      winnerTeamId: null,
    });
  }
  matches.push({
    id: "r3_m0",
    round: 3,
    matchIndex: 0,
    team1Id: null,
    team2Id: null,
    matchId: null,
    winnerTeamId: null,
  });

  return matches;
}

export async function createTournament(
  db: Firestore,
  input: {
    name: string;
    description?: string;
    registrationFeeCoins: number;
    maxTeams?: number;
    startsAt: Date;
  }
): Promise<string> {
  const ref = db.collection("tournaments").doc();
  await ref.set({
    name: input.name,
    description: input.description ?? "",
    registrationFeeCoins: input.registrationFeeCoins,
    maxTeams: input.maxTeams ?? 8,
    registeredTeamCount: 0,
    championRewardCoins: 0,
    status: "registration",
    startsAt: Timestamp.fromDate(input.startsAt),
    createdAt: FieldValue.serverTimestamp(),
    bracket: [],
    championTeamId: null,
    runnerUpTeamId: null,
  });
  return ref.id;
}

export async function startTournamentBracket(
  db: Firestore,
  tournamentId: string
): Promise<void> {
  const tournamentRef = db.collection("tournaments").doc(tournamentId);
  const tournamentSnap = await tournamentRef.get();
  if (!tournamentSnap.exists) throw new Error("Tournament not found.");

  const tournament = tournamentSnap.data()!;
  if (tournament.status !== "registration") return;

  const teamsSnap = await tournamentRef.collection("teams").get();
  const teamIds = teamsSnap.docs.map((d) => d.id);
  if (teamIds.length < 2) {
    await tournamentRef.update({ status: "cancelled" });
    return;
  }

  const bracket = buildSingleEliminationBracket(teamIds);
  await tournamentRef.update({
    status: "active",
    bracket,
  });
}

export async function advanceTournamentOnMatchComplete(
  db: Firestore,
  tournamentId: string,
  matchId: string,
  winnerTeamId: string
): Promise<void> {
  const tournamentRef = db.collection("tournaments").doc(tournamentId);
  const tournamentSnap = await tournamentRef.get();
  if (!tournamentSnap.exists) return;

  const tournament = tournamentSnap.data()!;
  const bracket = (tournament.bracket as TournamentBracketMatch[]) ?? [];
  let bracketIndex = bracket.findIndex((m) => m.matchId === matchId);
  if (bracketIndex < 0 && matchId.startsWith("walkover_")) {
    const slotId = matchId.replace("walkover_", "");
    bracketIndex = bracket.findIndex((m) => m.id === slotId);
  }
  if (bracketIndex < 0) return;

  await applyBracketWinner(db, tournamentId, bracket, bracketIndex, winnerTeamId);
}

async function applyBracketWinner(
  db: Firestore,
  tournamentId: string,
  bracket: TournamentBracketMatch[],
  bracketIndex: number,
  winnerTeamId: string
): Promise<void> {
  const tournamentRef = db.collection("tournaments").doc(tournamentId);
  const updated = [...bracket];
  updated[bracketIndex] = { ...updated[bracketIndex]!, winnerTeamId };

  const current = updated[bracketIndex]!;
  const nextRound = current.round + 1;
  const nextMatchIndex = Math.floor(current.matchIndex / 2);
  const nextBracketIndex = updated.findIndex(
    (m) => m.round === nextRound && m.matchIndex === nextMatchIndex
  );

  if (nextBracketIndex >= 0) {
    const slot = current.matchIndex % 2 === 0 ? "team1Id" : "team2Id";
    updated[nextBracketIndex] = {
      ...updated[nextBracketIndex]!,
      [slot]: winnerTeamId,
    };
  }

  const isFinal = current.round === 3;
  if (isFinal) {
    const loserTeamId =
      current.team1Id === winnerTeamId ? current.team2Id : current.team1Id;
    await tournamentRef.update({
      bracket: updated,
      status: "completed",
      championTeamId: winnerTeamId,
      runnerUpTeamId: loserTeamId,
    });
    await payTournamentRewards(db, tournamentId, winnerTeamId, loserTeamId);
    return;
  }

  await tournamentRef.update({ bracket: updated });
  await spawnBracketMatches(db, tournamentId, nextRound);
}

async function loadTeamMembers(
  db: Firestore,
  tournamentId: string,
  teamId: string
) {
  const teamSnap = await db
    .collection("tournaments")
    .doc(tournamentId)
    .collection("teams")
    .doc(teamId)
    .get();
  if (!teamSnap.exists) return null;

  const team = teamSnap.data()!;
  const [p1, p2] = await Promise.all([
    db.collection("users").doc(team.player1Uid as string).get(),
    db.collection("users").doc(team.player2Uid as string).get(),
  ]);

  return [
    {
      uid: team.player1Uid as string,
      displayName: (p1.data()?.displayName as string) ?? team.player1DisplayName,
      photoURL: (p1.data()?.photoURL as string | null) ?? null,
      rating: (p1.data()?.rating as number) ?? 1200,
    },
    {
      uid: team.player2Uid as string,
      displayName: (p2.data()?.displayName as string) ?? team.player2DisplayName,
      photoURL: (p2.data()?.photoURL as string | null) ?? null,
      rating: (p2.data()?.rating as number) ?? 1200,
    },
  ];
}

export async function spawnBracketMatches(
  db: Firestore,
  tournamentId: string,
  round: number
): Promise<void> {
  const tournamentRef = db.collection("tournaments").doc(tournamentId);
  const tournamentSnap = await tournamentRef.get();
  if (!tournamentSnap.exists) return;

  const bracket = (tournamentSnap.data()?.bracket as TournamentBracketMatch[]) ?? [];
  const roundMatches = bracket.filter((m) => m.round === round);
  const updated = [...bracket];
  let changed = false;

  for (const bracketMatch of roundMatches) {
    const index = updated.findIndex((m) => m.id === bracketMatch.id);
    if (index < 0 || updated[index]!.matchId) continue;

    const team1Id = updated[index]!.team1Id;
    const team2Id = updated[index]!.team2Id;

    if (team1Id && !team2Id) {
      updated[index] = { ...updated[index]!, winnerTeamId: team1Id };
      changed = true;
      continue;
    }
    if (!team1Id && team2Id) {
      updated[index] = { ...updated[index]!, winnerTeamId: team2Id };
      changed = true;
      continue;
    }
    if (!team1Id || !team2Id) continue;

    const team1Members = await loadTeamMembers(db, tournamentId, team1Id);
    const team2Members = await loadTeamMembers(db, tournamentId, team2Id);
    if (!team1Members || !team2Members) continue;

    const players = buildPlayersFromTeams(team1Members, team2Members);
    const matchId = await createMatchAdmin(db, {
      mode: "private",
      players,
      tournamentId,
      tournamentBracketMatchId: bracketMatch.id,
      tournamentTeam1Id: team1Id,
      tournamentTeam2Id: team2Id,
    });

    updated[index] = { ...updated[index]!, matchId };
    changed = true;
  }

  if (changed) {
    await tournamentRef.update({ bracket: updated });

    for (const bracketMatch of updated.filter((m) => m.round === round)) {
      if (bracketMatch.winnerTeamId && !bracketMatch.matchId) {
        const idx = updated.findIndex((m) => m.id === bracketMatch.id);
        if (idx >= 0) {
          await applyBracketWinner(
            db,
            tournamentId,
            updated,
            idx,
            bracketMatch.winnerTeamId
          );
        }
      }
    }
  }
}

async function payTournamentRewards(
  db: Firestore,
  tournamentId: string,
  championTeamId: string,
  runnerUpTeamId: string | null
): Promise<void> {
  const tournamentRef = db.collection("tournaments").doc(tournamentId);
  const tournamentSnap = await tournamentRef.get();
  if (!tournamentSnap.exists) return;

  const rewardPool = (tournamentSnap.data()?.championRewardCoins as number) ?? 0;
  const championShare = Math.floor(rewardPool * CHAMPION_REWARD_SPLIT.champion);
  const runnerUpShare = rewardPool - championShare;

  const championTeam = await tournamentRef.collection("teams").doc(championTeamId).get();
  if (!championTeam.exists) return;

  const ct = championTeam.data()!;
  const championUids = [ct.player1Uid, ct.player2Uid] as string[];
  const perChampion = Math.floor(championShare / 2);

  for (const uid of championUids) {
    await creditCoins(db, {
      uid,
      amount: perChampion,
      type: "champion_reward",
      refId: `${tournamentId}_champion_${uid}`,
      metadata: { tournamentId, role: "champion" },
    });
  }

  if (runnerUpTeamId && runnerUpShare > 0) {
    const runnerTeam = await tournamentRef.collection("teams").doc(runnerUpTeamId).get();
    if (runnerTeam.exists) {
      const rt = runnerTeam.data()!;
      const runnerUids = [rt.player1Uid, rt.player2Uid] as string[];
      const perRunner = Math.floor(runnerUpShare / 2);
      for (const uid of runnerUids) {
        await creditCoins(db, {
          uid,
          amount: perRunner,
          type: "champion_reward",
          refId: `${tournamentId}_runner_${uid}`,
          metadata: { tournamentId, role: "runner_up" },
        });
      }
    }
  }
}
