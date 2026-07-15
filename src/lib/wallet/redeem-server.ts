import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { debitCoins, WalletError } from "@/lib/wallet/wallet-server";
import {
  getRedeemBundle,
  REDEEM_MIN_ACCOUNT_AGE_DAYS,
  REDEEM_MIN_MATCHES,
} from "@/lib/wallet/redeem-bundles";

export async function checkRedeemEligibility(
  db: Firestore,
  uid: string,
  emailVerified: boolean
): Promise<{ eligible: boolean; reasons: string[] }> {
  const reasons: string[] = [];
  const userSnap = await db.collection("users").doc(uid).get();
  if (!userSnap.exists) {
    return { eligible: false, reasons: ["User not found."] };
  }

  const data = userSnap.data()!;
  const completedMatches = (data.completedMatches as number) ?? 0;
  if (completedMatches < REDEEM_MIN_MATCHES) {
    reasons.push(`Play ${REDEEM_MIN_MATCHES - completedMatches} more matches (${completedMatches}/${REDEEM_MIN_MATCHES}).`);
  }

  const createdAt = data.createdAt?.toDate?.() as Date | undefined;
  if (createdAt) {
    const ageDays = (Date.now() - createdAt.getTime()) / (24 * 60 * 60 * 1000);
    if (ageDays < REDEEM_MIN_ACCOUNT_AGE_DAYS) {
      reasons.push(`Account must be at least ${REDEEM_MIN_ACCOUNT_AGE_DAYS} days old.`);
    }
  }

  if (!emailVerified) {
    reasons.push("Verify your email address to redeem.");
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

  return { eligible: reasons.length === 0, reasons };
}

export async function createRedemptionRequest(
  db: Firestore,
  uid: string,
  bundleId: string,
  gcashNumber: string,
  gcashName: string,
  emailVerified: boolean
): Promise<{ requestId: string; balanceAfter: number }> {
  const bundle = getRedeemBundle(bundleId);
  if (!bundle) throw new Error("Unknown redemption bundle.");

  const eligibility = await checkRedeemEligibility(db, uid, emailVerified);
  if (!eligibility.eligible) {
    throw new Error(eligibility.reasons[0] ?? "Not eligible to redeem.");
  }

  const normalizedNumber = gcashNumber.replace(/\D/g, "");
  if (normalizedNumber.length < 10 || normalizedNumber.length > 11) {
    throw new Error("Enter a valid GCash mobile number.");
  }
  if (!gcashName.trim()) {
    throw new Error("GCash account name is required.");
  }

  const requestRef = db.collection("redemptionRequests").doc();
  const refId = requestRef.id;

  try {
    const debitResult = await debitCoins(db, {
      uid,
      amount: -bundle.coins,
      type: "redeem_lock",
      refId,
      metadata: { bundleId, phpAmount: bundle.phpAmount },
    });

    await requestRef.set({
      uid,
      bundleId,
      coins: bundle.coins,
      phpAmount: bundle.phpAmount,
      gcashNumber: normalizedNumber,
      gcashName: gcashName.trim(),
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
