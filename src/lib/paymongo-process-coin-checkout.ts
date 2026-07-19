import { FieldValue } from "firebase-admin/firestore";
import {
  fetchPaymongoCheckoutSession,
  fetchPaymongoPaymentIntent,
} from "@/lib/paymongo";
import {
  fulfillCoinPurchase,
  getPurchaseStatusForUser,
} from "@/lib/paymongo-coin-fulfillment";
import { getAdminDb } from "@/lib/firebase-admin";

export type ProcessCoinCheckoutResult = {
  processed: boolean;
  duplicate?: boolean;
  message?: string;
  baseCoins?: number;
  bonusCoins?: number;
  coinsCredited?: number;
};

async function markSessionProcessed(sessionId: string): Promise<boolean> {
  const db = getAdminDb();
  const ref = db.collection("paymongoProcessedSessions").doc(sessionId);
  const existing = await ref.get();
  if (existing.exists) return false;
  await ref.set({ processedAt: new Date().toISOString() });
  return true;
}

export async function processPaidCoinCheckoutSession(
  sessionId: string,
  secretKey: string,
  options?: { expectedUid?: string }
): Promise<ProcessCoinCheckoutResult> {
  const session = await fetchPaymongoCheckoutSession(sessionId, secretKey);
  if (!session) {
    throw new Error("Checkout session not found.");
  }

  const purchaseId = session.metadata.purchaseId;
  const uid = session.metadata.uid;
  if (!purchaseId || !uid) {
    throw new Error("Checkout session is missing purchase metadata.");
  }

  if (options?.expectedUid && uid !== options.expectedUid) {
    throw new Error("This payment does not belong to your account.");
  }

  if (session.status !== "paid") {
    return {
      processed: false,
      message: "Payment is still processing. Please wait a moment.",
    };
  }

  const shouldProcess = await markSessionProcessed(sessionId);
  if (!shouldProcess) {
    const status = await getPurchaseStatusForUser(purchaseId, uid);
    return {
      processed: true,
      duplicate: true,
      baseCoins: status.baseCoins,
      bonusCoins: status.bonusCoins,
      coinsCredited: status.coinsCredited,
    };
  }

  try {
    const result = await fulfillCoinPurchase(purchaseId);
    return {
      processed: true,
      baseCoins: result.baseCoins,
      bonusCoins: result.bonusCoins,
      coinsCredited: result.coinsCredited,
    };
  } catch (error) {
    try {
      await getAdminDb()
        .collection("paymongoProcessedSessions")
        .doc(sessionId)
        .delete();
    } catch {
      /* allow retry */
    }
    throw error;
  }
}

export async function processPaidQrphIntent(
  paymentIntentId: string,
  secretKey: string,
  options?: { expectedUid?: string }
): Promise<ProcessCoinCheckoutResult> {
  const intent = await fetchPaymongoPaymentIntent(paymentIntentId, secretKey);
  if (!intent) {
    throw new Error("Payment intent not found.");
  }

  const purchaseId = intent.metadata.purchaseId;
  const uid = intent.metadata.uid;
  if (!purchaseId || !uid) {
    throw new Error("Payment intent is missing purchase metadata.");
  }

  if (options?.expectedUid && uid !== options.expectedUid) {
    throw new Error("This payment does not belong to your account.");
  }

  if (intent.status !== "paid") {
    return {
      processed: false,
      message: "Payment is still processing. Please wait a moment.",
    };
  }

  const shouldProcess = await markSessionProcessed(paymentIntentId);
  if (!shouldProcess) {
    const status = await getPurchaseStatusForUser(purchaseId, uid);
    return {
      processed: true,
      duplicate: true,
      baseCoins: status.baseCoins,
      bonusCoins: status.bonusCoins,
      coinsCredited: status.coinsCredited,
    };
  }

  try {
    const result = await fulfillCoinPurchase(purchaseId);
    return {
      processed: true,
      baseCoins: result.baseCoins,
      bonusCoins: result.bonusCoins,
      coinsCredited: result.coinsCredited,
    };
  } catch (error) {
    try {
      await getAdminDb()
        .collection("paymongoProcessedSessions")
        .doc(paymentIntentId)
        .delete();
    } catch {
      /* allow retry */
    }
    throw error;
  }
}

export async function createPendingCoinPurchase(
  uid: string,
  pack: { id: string; coins: number; amountCentavos: number }
): Promise<{ purchaseId: string; referenceNumber: string }> {
  const db = getAdminDb();
  const purchaseRef = db.collection("coinPurchases").doc();
  const purchaseId = purchaseRef.id;
  const referenceNumber = `BA-${purchaseId.slice(0, 8).toUpperCase()}`;

  await purchaseRef.set({
    uid,
    packId: pack.id,
    coins: pack.coins,
    amountCentavos: pack.amountCentavos,
    status: "pending",
    referenceNumber,
    createdAt: FieldValue.serverTimestamp(),
  });

  return { purchaseId, referenceNumber };
}

export async function attachCheckoutSessionToPurchase(
  purchaseId: string,
  checkoutSessionId: string
): Promise<void> {
  await getAdminDb().collection("coinPurchases").doc(purchaseId).update({
    paymongoCheckoutSessionId: checkoutSessionId,
  });
}

export async function attachPaymentIntentToPurchase(
  purchaseId: string,
  paymentIntentId: string
): Promise<void> {
  await getAdminDb().collection("coinPurchases").doc(purchaseId).update({
    paymongoPaymentIntentId: paymentIntentId,
  });
}
