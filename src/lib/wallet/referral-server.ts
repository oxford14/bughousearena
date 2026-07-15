import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { creditCoins } from "@/lib/wallet/wallet-server";

export const REFERRAL_FIRST_MATCH_COINS = 50;
export const REFERRAL_TOPUP_COINS = 150;
export const REFERRAL_TOPUP_THRESHOLD_CENTAVOS = 50_000; // ₱500
export const REFERRAL_APPLY_WINDOW_DAYS = 7;

function generateReferralCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function ensureReferralCode(
  db: Firestore,
  uid: string
): Promise<string> {
  const userRef = db.collection("users").doc(uid);
  const userSnap = await userRef.get();
  if (!userSnap.exists) throw new Error("User not found.");

  const existing = userSnap.data()?.referralCode as string | undefined;
  if (existing) return existing;

  for (let attempt = 0; attempt < 8; attempt++) {
    const code = generateReferralCode();
    const codeRef = db.collection("referralCodes").doc(code);
    try {
      await db.runTransaction(async (tx) => {
        const codeSnap = await tx.get(codeRef);
        if (codeSnap.exists) throw new Error("collision");
        tx.set(codeRef, { uid, createdAt: FieldValue.serverTimestamp() });
        tx.update(userRef, { referralCode: code });
      });
      return code;
    } catch {
      continue;
    }
  }

  throw new Error("Could not generate referral code.");
}

export async function applyReferralCode(
  db: Firestore,
  referredUid: string,
  code: string
): Promise<{ applied: boolean; referrerUid?: string }> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) throw new Error("Referral code is required.");

  const userRef = db.collection("users").doc(referredUid);
  const userSnap = await userRef.get();
  if (!userSnap.exists) throw new Error("User not found.");

  const userData = userSnap.data()!;
  if (userData.referredByUid) {
    throw new Error("Referral code already applied.");
  }

  const createdAt = userData.createdAt?.toDate?.() as Date | undefined;
  if (createdAt) {
    const ageMs = Date.now() - createdAt.getTime();
    if (ageMs > REFERRAL_APPLY_WINDOW_DAYS * 24 * 60 * 60 * 1000) {
      throw new Error("Referral code must be applied within 7 days of signup.");
    }
  }

  const codeSnap = await db.collection("referralCodes").doc(normalized).get();
  if (!codeSnap.exists) throw new Error("Invalid referral code.");

  const referrerUid = codeSnap.data()!.uid as string;
  if (referrerUid === referredUid) {
    throw new Error("You cannot use your own referral code.");
  }

  const referralRef = db.collection("referrals").doc(referredUid);
  const existingReferral = await referralRef.get();
  if (existingReferral.exists) {
    throw new Error("Referral already recorded.");
  }

  await db.runTransaction(async (tx) => {
    tx.set(referralRef, {
      referredUid,
      referrerUid,
      referralCode: normalized,
      status: "pending",
      firstMatchRewarded: false,
      topUpRewarded: false,
      createdAt: FieldValue.serverTimestamp(),
    });
    tx.update(userRef, { referredByUid: referrerUid });
  });

  return { applied: true, referrerUid };
}

export async function rewardReferralFirstMatch(
  db: Firestore,
  referredUid: string
): Promise<void> {
  const referralRef = db.collection("referrals").doc(referredUid);
  const referralSnap = await referralRef.get();
  if (!referralSnap.exists) return;

  const data = referralSnap.data()!;
  if (data.firstMatchRewarded) return;

  const referrerUid = data.referrerUid as string;
  await creditCoins(db, {
    uid: referrerUid,
    amount: REFERRAL_FIRST_MATCH_COINS,
    type: "referral",
    refId: `first_match_${referredUid}`,
    metadata: { referredUid, reason: "first_match" },
  });

  await referralRef.update({
    firstMatchRewarded: true,
    status: "active",
  });
}

export async function rewardReferralTopUp(
  db: Firestore,
  referredUid: string,
  totalTopUpCentavos: number
): Promise<void> {
  if (totalTopUpCentavos < REFERRAL_TOPUP_THRESHOLD_CENTAVOS) return;

  const referralRef = db.collection("referrals").doc(referredUid);
  const referralSnap = await referralRef.get();
  if (!referralSnap.exists) return;

  const data = referralSnap.data()!;
  if (data.topUpRewarded) return;

  const referrerUid = data.referrerUid as string;
  await creditCoins(db, {
    uid: referrerUid,
    amount: REFERRAL_TOPUP_COINS,
    type: "referral",
    refId: `topup_${referredUid}`,
    metadata: { referredUid, reason: "topup_500" },
  });

  await referralRef.update({
    topUpRewarded: true,
    status: "completed",
  });
}
