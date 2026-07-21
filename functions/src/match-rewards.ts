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
  _matchId: string,
  match: Record<string, unknown>,
  _winnerTeam: 1 | 2
): Promise<void> {
  // Bracket advancement + champion payout run exclusively via
  // POST /api/tournaments/advance-match (match result screen) to avoid
  // double-writes and keep wait-for-round / payout logic in one place.
  if (!match.tournamentId) return;
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
