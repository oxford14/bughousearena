import { FieldValue } from "firebase-admin/firestore";
import { getFirstTopUpBonusCoins } from "@/lib/shop/coin-packs";
import { getAdminDb } from "@/lib/firebase-admin";
import { creditCoins } from "@/lib/wallet/wallet-server";
import { rewardReferralTopUp } from "@/lib/wallet/referral-server";

export type FulfillPurchaseResult = {
  credited: boolean;
  baseCoins: number;
  bonusCoins: number;
  coinsCredited: number;
  status: "paid" | "pending";
};

export async function fulfillCoinPurchase(
  purchaseId: string
): Promise<FulfillPurchaseResult> {
  const db = getAdminDb();
  const purchaseRef = db.collection("coinPurchases").doc(purchaseId);

  const purchaseSnap = await purchaseRef.get();
  if (!purchaseSnap.exists) {
    throw new Error("Purchase not found.");
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
      status: "paid",
    };
  }

  const uid = purchase.uid as string;
  const packId = purchase.packId as string;
  const userRef = db.collection("users").doc(uid);
  const userSnap = await userRef.get();

  const usedPackIds =
    (userSnap.data()?.firstTopUpBonusUsedPackIds as string[] | undefined) ??
    [];
  const bonusEligible = !usedPackIds.includes(packId);
  const bonusCoins = bonusEligible ? getFirstTopUpBonusCoins(baseCoins) : 0;
  const coinsCredited = baseCoins + bonusCoins;
  const amountCentavos = (purchase.amountCentavos as number) ?? 0;
  const previousTopUp =
    (userSnap.data()?.totalTopUpCentavos as number | undefined) ?? 0;

  const creditResult = await creditCoins(db, {
    uid,
    amount: coinsCredited,
    type: "topup",
    refId: purchaseId,
    metadata: { packId, bonusCoins },
  });

  if (creditResult.credited) {
    await userRef.update({
      totalTopUpCentavos: FieldValue.increment(amountCentavos),
      ...(bonusEligible
        ? { firstTopUpBonusUsedPackIds: FieldValue.arrayUnion(packId) }
        : {}),
    });
    await purchaseRef.update({
      status: "paid",
      bonusCoins,
      coinsCredited,
      paidAt: FieldValue.serverTimestamp(),
    });

    const newTotal = previousTopUp + amountCentavos;
    await rewardReferralTopUp(db, uid, newTotal);
  }

  return {
    credited: creditResult.credited,
    baseCoins,
    bonusCoins,
    coinsCredited,
    status: "paid",
  };
}

export async function getPurchaseStatusForUser(
  purchaseId: string,
  uid: string
): Promise<FulfillPurchaseResult & { packId: string }> {
  const db = getAdminDb();
  const snap = await db.collection("coinPurchases").doc(purchaseId).get();
  if (!snap.exists) {
    throw new Error("Purchase not found.");
  }

  const data = snap.data()!;
  if (data.uid !== uid) {
    throw new Error("Not your purchase.");
  }

  const baseCoins = data.coins as number;
  const bonusCoins = (data.bonusCoins as number | undefined) ?? 0;
  const coinsCredited =
    (data.coinsCredited as number | undefined) ?? baseCoins;

  return {
    credited: data.status === "paid",
    baseCoins,
    bonusCoins,
    coinsCredited,
    status: data.status === "paid" ? "paid" : "pending",
    packId: data.packId as string,
  };
}
