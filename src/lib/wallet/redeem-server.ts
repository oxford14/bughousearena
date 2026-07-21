import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { debitCoins, WalletError } from "@/lib/wallet/wallet-server";
import {
  getRedeemBundle,
  REDEEM_MIN_ACCOUNT_AGE_DAYS,
  REDEEM_MIN_RANKED_MATCHES,
} from "@/lib/wallet/redeem-bundles";
import {
  stripAccountDigits,
  validatePayoutDestination,
} from "@/lib/wallet/payout-methods";
import { isSuperAdmin } from "@/lib/server/verify-super-admin";

export async function checkRedeemEligibility(
  db: Firestore,
  uid: string
): Promise<{ eligible: boolean; reasons: string[]; bypassed?: boolean }> {
  const reasons: string[] = [];
  const userSnap = await db.collection("users").doc(uid).get();
  if (!userSnap.exists) {
    return { eligible: false, reasons: ["User not found."] };
  }

  const data = userSnap.data()!;
  const bypassPlayGates = await isSuperAdmin(
    uid,
    (data.email as string | null | undefined) ?? null
  );

  if (!bypassPlayGates) {
    const rankedPlayed =
      ((data.rankedWins as number | undefined) ?? 0) +
      ((data.rankedLosses as number | undefined) ?? 0);
    if (rankedPlayed < REDEEM_MIN_RANKED_MATCHES) {
      reasons.push(
        `Play ${REDEEM_MIN_RANKED_MATCHES - rankedPlayed} more ranked games (${rankedPlayed}/${REDEEM_MIN_RANKED_MATCHES}).`
      );
    }

    const createdAt = data.createdAt?.toDate?.() as Date | undefined;
    if (createdAt) {
      const ageDays =
        (Date.now() - createdAt.getTime()) / (24 * 60 * 60 * 1000);
      if (ageDays < REDEEM_MIN_ACCOUNT_AGE_DAYS) {
        reasons.push(
          `Account must be at least ${REDEEM_MIN_ACCOUNT_AGE_DAYS} days old.`
        );
      }
    }
  }

  const pendingSnap = await db
    .collection("redemptionRequests")
    .where("uid", "==", uid)
    .where("status", "==", "pending")
    .limit(1)
    .get();
  if (!pendingSnap.empty) {
    reasons.push("You already have a pending redemption request.");
  }

  return {
    eligible: reasons.length === 0,
    reasons,
    ...(bypassPlayGates ? { bypassed: true } : {}),
  };
}

export async function createRedemptionRequest(
  db: Firestore,
  uid: string,
  input: {
    bundleId: string;
    payoutMethod: "gcash" | "maya" | "bank";
    accountName: string;
    accountNumber: string;
    bankName?: string | null;
  }
): Promise<{ requestId: string; balanceAfter: number }> {
  const bundle = getRedeemBundle(input.bundleId);
  if (!bundle) throw new Error("Unknown redemption bundle.");

  const eligibility = await checkRedeemEligibility(db, uid);
  if (!eligibility.eligible) {
    throw new Error(eligibility.reasons[0] ?? "Not eligible to redeem.");
  }

  const validationError = validatePayoutDestination({
    method: input.payoutMethod,
    accountName: input.accountName,
    accountNumber: input.accountNumber,
    bankName: input.bankName,
  });
  if (validationError) throw new Error(validationError);

  const accountNumber = stripAccountDigits(input.accountNumber);
  const accountName = input.accountName.trim();
  const bankName =
    input.payoutMethod === "bank" ? input.bankName?.trim() ?? null : null;

  const requestRef = db.collection("redemptionRequests").doc();
  const refId = requestRef.id;

  try {
    const debitResult = await debitCoins(db, {
      uid,
      amount: -bundle.coins,
      type: "redeem_lock",
      refId,
      metadata: {
        bundleId: input.bundleId,
        phpAmount: bundle.phpAmount,
        payoutMethod: input.payoutMethod,
      },
    });

    await requestRef.set({
      uid,
      bundleId: input.bundleId,
      coins: bundle.coins,
      phpAmount: bundle.phpAmount,
      payoutMethod: input.payoutMethod,
      accountName,
      accountNumber,
      bankName,
      // Legacy fields for older admin UIs / payouts
      gcashNumber: accountNumber,
      gcashName: accountName,
      status: "pending",
      createdAt: FieldValue.serverTimestamp(),
    });

    return { requestId: refId, balanceAfter: debitResult.balanceAfter };
  } catch (error) {
    if (error instanceof WalletError && error.code === "INSUFFICIENT_FUNDS") {
      throw new Error("Not enough Arena Coins for this bundle.");
    }
    throw error;
  }
}

export async function markRedemptionProcessing(
  db: Firestore,
  requestId: string,
  transferId: string,
  batchId: string
): Promise<void> {
  const requestRef = db.collection("redemptionRequests").doc(requestId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(requestRef);
    if (!snap.exists) throw new Error("Request not found.");
    const status = snap.data()!.status as string;
    if (status !== "pending") {
      throw new Error(`Request is not payable (status: ${status}).`);
    }
    tx.update(requestRef, {
      status: "processing",
      paymongoTransferId: transferId,
      paymongoBatchId: batchId,
    });
  });
}

/** Marks a redemption paid, matched by its PayMongo transfer id. Idempotent. */
export async function markRedemptionPaidByTransfer(
  db: Firestore,
  transferId: string
): Promise<boolean> {
  const snap = await db
    .collection("redemptionRequests")
    .where("paymongoTransferId", "==", transferId)
    .limit(1)
    .get();
  if (snap.empty) return false;

  const requestRef = snap.docs[0]!.ref;
  return db.runTransaction(async (tx) => {
    const fresh = await tx.get(requestRef);
    const status = fresh.data()!.status as string;
    if (status === "paid") return false;
    tx.update(requestRef, {
      status: "paid",
      processedAt: FieldValue.serverTimestamp(),
    });
    return true;
  });
}

/**
 * Marks a redemption failed and refunds coins, matched by transfer id.
 * Idempotent — only refunds once.
 */
export async function markRedemptionFailedByTransfer(
  db: Firestore,
  transferId: string,
  note?: string
): Promise<boolean> {
  const snap = await db
    .collection("redemptionRequests")
    .where("paymongoTransferId", "==", transferId)
    .limit(1)
    .get();
  if (snap.empty) return false;

  const requestRef = snap.docs[0]!.ref;
  return db.runTransaction(async (tx) => {
    const fresh = await tx.get(requestRef);
    const data = fresh.data()!;
    if (data.status === "failed" || data.status === "rejected") return false;

    const uid = data.uid as string;
    const coins = data.coins as number;
    const userRef = db.collection("users").doc(uid);
    const userSnap = await tx.get(userRef);
    const balance = (userSnap.data()?.arenaCoins as number) ?? 0;
    const nextBalance = balance + coins;

    tx.update(userRef, { arenaCoins: nextBalance });
    tx.set(db.collection("coinLedger").doc(`redeem_refund_${fresh.id}_${uid}`), {
      uid,
      amount: coins,
      type: "redeem_refund",
      refId: fresh.id,
      balanceAfter: nextBalance,
      metadata: { reason: "transfer_failed", note: note ?? null },
      createdAt: FieldValue.serverTimestamp(),
    });
    tx.update(requestRef, {
      status: "failed",
      adminNote: note ?? "PayMongo transfer failed.",
      processedAt: FieldValue.serverTimestamp(),
    });
    return true;
  });
}

export async function processRedemptionRequest(
  db: Firestore,
  requestId: string,
  action: "paid" | "reject",
  adminNote?: string
): Promise<void> {
  const requestRef = db.collection("redemptionRequests").doc(requestId);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(requestRef);
    if (!snap.exists) throw new Error("Request not found.");

    const data = snap.data()!;
    if (data.status !== "pending") {
      throw new Error("Request already processed.");
    }

    if (action === "paid") {
      tx.update(requestRef, {
        status: "paid",
        adminNote: adminNote ?? null,
        processedAt: FieldValue.serverTimestamp(),
      });
      return;
    }

    const uid = data.uid as string;
    const coins = data.coins as number;
    const userRef = db.collection("users").doc(uid);
    const userSnap = await tx.get(userRef);
    const balance = (userSnap.data()?.arenaCoins as number) ?? 0;
    const nextBalance = balance + coins;

    tx.update(userRef, { arenaCoins: nextBalance });
    tx.set(db.collection("coinLedger").doc(`redeem_refund_${requestId}_${uid}`), {
      uid,
      amount: coins,
      type: "redeem_refund",
      refId: requestId,
      balanceAfter: nextBalance,
      metadata: { adminNote: adminNote ?? null },
      createdAt: FieldValue.serverTimestamp(),
    });
    tx.update(requestRef, {
      status: "rejected",
      adminNote: adminNote ?? null,
      processedAt: FieldValue.serverTimestamp(),
    });
  });
}
