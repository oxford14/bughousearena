import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { getFirstTopUpBonusCoins } from "./coin-packs";
import type { CoinPack } from "./coin-packs";

export type CoinPurchaseStatus = "pending" | "paid" | "failed" | "expired";

export interface CoinPurchaseRecord {
  uid: string;
  packId: string;
  /** Base pack coin amount (before bonus). */
  coins: number;
  bonusCoins?: number;
  coinsCredited?: number;
  amountCentavos: number;
  status: CoinPurchaseStatus;
  paymongoCheckoutSessionId?: string | null;
  referenceNumber: string;
  createdAt: FirebaseFirestore.FieldValue;
  paidAt?: FirebaseFirestore.FieldValue | null;
}

export interface FulfillPurchaseResult {
  credited: boolean;
  baseCoins: number;
  bonusCoins: number;
  coinsCredited: number;
}

export async function createPendingPurchase(
  db: Firestore,
  uid: string,
  pack: CoinPack
): Promise<{ purchaseId: string; referenceNumber: string }> {
  const purchaseRef = db.collection("coinPurchases").doc();
  const purchaseId = purchaseRef.id;
  const referenceNumber = `BA-${purchaseId.slice(0, 8).toUpperCase()}`;

  const record: CoinPurchaseRecord = {
    uid,
    packId: pack.id,
    coins: pack.coins,
    amountCentavos: pack.amountCentavos,
    status: "pending",
    referenceNumber,
    createdAt: FieldValue.serverTimestamp(),
  };

  await purchaseRef.set(record);
  return { purchaseId, referenceNumber };
}

export async function attachCheckoutSession(
  db: Firestore,
  purchaseId: string,
  checkoutSessionId: string
): Promise<void> {
  await db.collection("coinPurchases").doc(purchaseId).update({
    paymongoCheckoutSessionId: checkoutSessionId,
  });
}

export async function fulfillPurchase(
  db: Firestore,
  purchaseId: string
): Promise<FulfillPurchaseResult> {
  const purchaseRef = db.collection("coinPurchases").doc(purchaseId);

  return db.runTransaction(async (tx) => {
    const purchaseSnap = await tx.get(purchaseRef);
    if (!purchaseSnap.exists) {
      throw new Error("Purchase not found");
    }

    const purchase = purchaseSnap.data()!;
    const baseCoins = purchase.coins as number;

    if (purchase.status === "paid") {
      return {
        credited: false,
        baseCoins,
        bonusCoins: (purchase.bonusCoins as number | undefined) ?? 0,
        coinsCredited:
          (purchase.coinsCredited as number | undefined) ?? baseCoins,
      };
    }

    const uid = purchase.uid as string;
    const packId = purchase.packId as string;
    const userRef = db.collection("users").doc(uid);
    const userSnap = await tx.get(userRef);

    const usedPackIds = (userSnap.data()?.firstTopUpBonusUsedPackIds as
      | string[]
      | undefined) ?? [];
    const bonusEligible = !usedPackIds.includes(packId);
    const bonusCoins = bonusEligible ? getFirstTopUpBonusCoins(baseCoins) : 0;
    const coinsCredited = baseCoins + bonusCoins;

    tx.update(userRef, {
      arenaCoins: FieldValue.increment(coinsCredited),
      ...(bonusEligible
        ? { firstTopUpBonusUsedPackIds: FieldValue.arrayUnion(packId) }
        : {}),
    });
    tx.update(purchaseRef, {
      status: "paid",
      bonusCoins,
      coinsCredited,
      paidAt: FieldValue.serverTimestamp(),
    });

    return { credited: true, baseCoins, bonusCoins, coinsCredited };
  });
}

export async function findPurchaseIdFromWebhook(
  db: Firestore,
  metadata: Record<string, unknown> | undefined,
  referenceNumber: string | undefined
): Promise<string | null> {
  const fromMetadata = metadata?.purchaseId;
  if (typeof fromMetadata === "string" && fromMetadata.length > 0) {
    return fromMetadata;
  }

  if (!referenceNumber) return null;

  const snap = await db
    .collection("coinPurchases")
    .where("referenceNumber", "==", referenceNumber)
    .limit(1)
    .get();

  if (snap.empty) return null;
  return snap.docs[0]!.id;
}
