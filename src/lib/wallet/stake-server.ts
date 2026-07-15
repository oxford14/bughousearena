import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { debitCoins, creditCoins, WalletError } from "@/lib/wallet/wallet-server";
import { isValidStakeTier } from "@/lib/wallet/stake-tiers";

export async function lockStakeForQueue(
  db: Firestore,
  uid: string,
  stakeAmount: number,
  queueEntryId: string
): Promise<{ balanceAfter: number }> {
  if (!isValidStakeTier(stakeAmount)) {
    throw new Error("Invalid stake tier.");
  }

  const lockRef = db.collection("stakeLocks").doc(uid);
  const existing = await lockRef.get();
  if (existing.exists && existing.data()?.status === "locked") {
    throw new Error("You already have an active stake lock.");
  }

  try {
    const result = await debitCoins(db, {
      uid,
      amount: -stakeAmount,
      type: "stake_lock",
      refId: queueEntryId,
      metadata: { stakeAmount },
    });

    await lockRef.set({
      uid,
      stakeAmount,
      queueEntryId,
      matchId: null,
      status: "locked",
      createdAt: FieldValue.serverTimestamp(),
    });

    return { balanceAfter: result.balanceAfter };
  } catch (error) {
    if (error instanceof WalletError && error.code === "INSUFFICIENT_FUNDS") {
      throw new Error("Not enough Arena Coins for this stake.");
    }
    throw error;
  }
}

export async function refundStakeLock(
  db: Firestore,
  uid: string,
  reason: string
): Promise<void> {
  const lockRef = db.collection("stakeLocks").doc(uid);
  const lockSnap = await lockRef.get();
  if (!lockSnap.exists) return;

  const lock = lockSnap.data()!;
  if (lock.status !== "locked") return;

  const stakeAmount = lock.stakeAmount as number;
  const refId = (lock.queueEntryId as string) ?? (lock.matchId as string) ?? uid;

  await creditCoins(db, {
    uid,
    amount: stakeAmount,
    type: "stake_refund",
    refId: `${refId}_refund`,
    metadata: { reason },
  });

  await lockRef.update({ status: "refunded" });
}

export async function bindStakeLockToMatch(
  db: Firestore,
  uid: string,
  matchId: string
): Promise<void> {
  const lockRef = db.collection("stakeLocks").doc(uid);
  const lockSnap = await lockRef.get();
  if (!lockSnap.exists) return;
  if (lockSnap.data()?.status !== "locked") return;
  await lockRef.update({ matchId });
}

export async function settleStakeMatch(
  db: Firestore,
  matchId: string,
  winnerTeam: 1 | 2,
  stakePerPlayer: number,
  playerUids: string[],
  players: Array<{ uid: string; team: 1 | 2; isBot?: boolean }>
): Promise<void> {
  const humanPlayers = players.filter((p) => !p.isBot && playerUids.includes(p.uid));
  const winners = humanPlayers.filter((p) => p.team === winnerTeam);
  const payoutPerWinner = Math.floor(stakePerPlayer * 2 * 0.9);

  for (const player of humanPlayers) {
    const lockRef = db.collection("stakeLocks").doc(player.uid);
    const lockSnap = await lockRef.get();
    if (!lockSnap.exists || lockSnap.data()?.status !== "locked") continue;

    if (player.team === winnerTeam) {
      await creditCoins(db, {
        uid: player.uid,
        amount: payoutPerWinner,
        type: "stake_win",
        refId: matchId,
        metadata: { stakePerPlayer, winnerTeam },
      });
    }

    await lockRef.update({ status: "settled", matchId });
  }
}
