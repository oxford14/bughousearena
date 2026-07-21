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

/**
 * Lock stake for every member on a queue entry (party stake).
 * Caller must own the queue entry. Rolls back if any member cannot lock.
 */
export async function lockStakeForQueueEntry(
  db: Firestore,
  callerUid: string,
  stakeAmount: number,
  queueEntryId: string
): Promise<{ balanceAfter: number }> {
  const entrySnap = await db.collection("matchmaking").doc(queueEntryId).get();
  if (!entrySnap.exists) {
    throw new Error("Queue entry not found.");
  }
  const entry = entrySnap.data()!;
  if (entry.uid !== callerUid) {
    throw new Error("Only the queue owner can lock stakes.");
  }

  const memberUids = Array.isArray(entry.memberUids)
    ? (entry.memberUids as string[])
    : [callerUid];
  const uniqueUids = [...new Set(memberUids.length > 0 ? memberUids : [callerUid])];

  const locked: string[] = [];
  let callerBalance = 0;
  try {
    for (const uid of uniqueUids) {
      const result = await lockStakeForQueue(db, uid, stakeAmount, queueEntryId);
      locked.push(uid);
      if (uid === callerUid) callerBalance = result.balanceAfter;
    }
    return { balanceAfter: callerBalance };
  } catch (error) {
    for (const uid of locked) {
      await refundStakeLock(db, uid, "party_stake_partial_fail").catch(() => {});
    }
    if (
      error instanceof Error &&
      error.message.includes("Not enough Arena Coins")
    ) {
      throw new Error(
        uniqueUids.length > 1
          ? "A party member does not have enough Arena Coins for this stake."
          : error.message
      );
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

/** Refund the caller's lock and any party members locked on the same queue entry. */
export async function refundStakeLocksForQueueCancel(
  db: Firestore,
  callerUid: string,
  queueEntryId?: string | null
): Promise<void> {
  const callerLock = await db.collection("stakeLocks").doc(callerUid).get();
  const entryId =
    queueEntryId ??
    (callerLock.exists ? (callerLock.data()?.queueEntryId as string | undefined) : undefined);

  if (!entryId) {
    await refundStakeLock(db, callerUid, "queue_cancel");
    return;
  }

  const memberUids = new Set<string>([callerUid]);
  const entrySnap = await db.collection("matchmaking").doc(entryId).get();
  if (entrySnap.exists) {
    const members = entrySnap.data()?.memberUids;
    if (Array.isArray(members)) {
      for (const uid of members) {
        if (typeof uid === "string") memberUids.add(uid);
      }
    }
  } else {
    // Queue may already be deleted — refund anyone still locked to this entry id.
    const locks = await db
      .collection("stakeLocks")
      .where("queueEntryId", "==", entryId)
      .get();
    for (const docSnap of locks.docs) {
      if (docSnap.data()?.status === "locked") {
        memberUids.add(docSnap.id);
      }
    }
  }

  for (const uid of memberUids) {
    await refundStakeLock(db, uid, "queue_cancel");
  }
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
