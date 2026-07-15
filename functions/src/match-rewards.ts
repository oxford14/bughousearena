import { initializeApp, getApps } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { onDocumentUpdated } from "firebase-functions/v2/firestore";

function getDb() {
  if (!getApps().length) initializeApp();
  return getFirestore();
}

const STAKE_FEE_RATE = 0.1;
const REFERRAL_FIRST_MATCH_COINS = 50;

function ledgerDocId(type: string, refId: string, uid: string): string {
  return `${type}_${refId}_${uid}`.replace(/[^a-zA-Z0-9_-]/g, "_");
}

async function creditCoins(
  uid: string,
  amount: number,
  type: string,
  refId: string,
  metadata?: Record<string, unknown>
): Promise<boolean> {
  const db = getDb();
  const ledgerId = ledgerDocId(type, refId, uid);
  const userRef = db.collection("users").doc(uid);
  const ledgerRef = db.collection("coinLedger").doc(ledgerId);

  return db.runTransaction(async (tx) => {
    const ledgerSnap = await tx.get(ledgerRef);
    if (ledgerSnap.exists) return false;

    const userSnap = await tx.get(userRef);
    if (!userSnap.exists) return false;

    const balance = (userSnap.data()?.arenaCoins as number) ?? 0;
    const nextBalance = balance + amount;

    tx.update(userRef, { arenaCoins: nextBalance });
    tx.set(ledgerRef, {
      uid,
      amount,
      type,
      refId,
      balanceAfter: nextBalance,
      metadata: metadata ?? null,
      createdAt: FieldValue.serverTimestamp(),
    });
    return true;
  });
}

async function settleStakeMatch(
  matchId: string,
  winnerTeam: 1 | 2,
  stakePerPlayer: number,
  players: Array<{ uid: string; team: 1 | 2; isBot?: boolean }>
): Promise<void> {
  const db = getDb();
  const payout = Math.floor(stakePerPlayer * 2 * (1 - STAKE_FEE_RATE));

  for (const player of players) {
    if (player.isBot) continue;
    const lockRef = db.collection("stakeLocks").doc(player.uid);
    const lockSnap = await lockRef.get();
    if (!lockSnap.exists || lockSnap.data()?.status !== "locked") continue;

    if (player.team === winnerTeam) {
      await creditCoins(player.uid, payout, "stake_win", matchId, {
        stakePerPlayer,
        winnerTeam,
      });
    }
    await lockRef.update({ status: "settled", matchId });
  }
}

async function rewardReferralFirstMatch(referredUid: string): Promise<void> {
  const db = getDb();
  const referralRef = db.collection("referrals").doc(referredUid);
  const referralSnap = await referralRef.get();
  if (!referralSnap.exists) return;
  const data = referralSnap.data()!;
  if (data.firstMatchRewarded) return;

  const referrerUid = data.referrerUid as string;
  const credited = await creditCoins(
    referrerUid,
    REFERRAL_FIRST_MATCH_COINS,
    "referral",
    `first_match_${referredUid}`,
    { referredUid, reason: "first_match" }
  );

  if (credited) {
    await referralRef.update({ firstMatchRewarded: true, status: "active" });
  }
}

async function incrementCompletedMatches(uids: string[]): Promise<void> {
  const db = getDb();
  const batch = db.batch();
  for (const uid of uids) {
    batch.update(db.collection("users").doc(uid), {
      completedMatches: FieldValue.increment(1),
    });
  }
  await batch.commit();
}

async function handleTournamentMatch(
  matchId: string,
  match: Record<string, unknown>,
  winnerTeam: 1 | 2
): Promise<void> {
  const tournamentId = match.tournamentId as string | undefined;
  const team1Id = match.tournamentTeam1Id as string | undefined;
  const team2Id = match.tournamentTeam2Id as string | undefined;
  if (!tournamentId || !team1Id || !team2Id) return;

  const winnerTeamId = winnerTeam === 1 ? team1Id : team2Id;

  // Dynamic import won't work in functions easily — inline minimal advance logic
  const db = getDb();
  const tournamentRef = db.collection("tournaments").doc(tournamentId);
  const tournamentSnap = await tournamentRef.get();
  if (!tournamentSnap.exists) return;

  const bracket = (tournamentSnap.data()?.bracket as Array<Record<string, unknown>>) ?? [];
  const bracketIndex = bracket.findIndex((m) => m.matchId === matchId);
  if (bracketIndex < 0) return;

  const updated = bracket.map((m) => ({ ...m }));
  updated[bracketIndex] = { ...updated[bracketIndex], winnerTeamId };

  const current = updated[bracketIndex]!;
  const nextRound = (current.round as number) + 1;
  const nextMatchIndex = Math.floor((current.matchIndex as number) / 2);
  const nextBracketIndex = updated.findIndex(
    (m) => m.round === nextRound && m.matchIndex === nextMatchIndex
  );

  if (nextBracketIndex >= 0) {
    const slot =
      (current.matchIndex as number) % 2 === 0 ? "team1Id" : "team2Id";
    updated[nextBracketIndex] = { ...updated[nextBracketIndex], [slot]: winnerTeamId };
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
    // Rewards handled by Next.js admin path or duplicate pay logic — skip in CF for now
    // Tournament rewards will be paid via API call from client result screen as fallback
    return;
  }

  await tournamentRef.update({ bracket: updated });
}

export const onMatchCompleted = onDocumentUpdated(
  "matches/{matchId}",
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;
    if (before.status === "completed" || after.status !== "completed") return;

    const matchId = event.params.matchId;
    const winnerTeam = after.winnerTeam as 1 | 2 | null;
    if (!winnerTeam) return;

    const playerUids = (after.playerUids as string[] | undefined) ?? [];
    const players = (after.players as Array<{ uid: string; team: 1 | 2; isBot?: boolean }>) ?? [];

    const processedRef = getDb().collection("matchRewardsProcessed").doc(matchId);
    const processedSnap = await processedRef.get();
    if (processedSnap.exists) return;

    if (after.stakePerPlayer) {
      await settleStakeMatch(
        matchId,
        winnerTeam,
        after.stakePerPlayer as number,
        players
      );
    }

    for (const uid of playerUids) {
      await rewardReferralFirstMatch(uid);
    }

    await incrementCompletedMatches(playerUids);

    if (after.tournamentId) {
      await handleTournamentMatch(matchId, after, winnerTeam);
    }

    await processedRef.set({
      processedAt: FieldValue.serverTimestamp(),
      winnerTeam,
    });
  }
);
