import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { ensureReferralCode } from "@/lib/wallet/referral-server";
import { enforceApiRateLimits } from "@/lib/server/rate-limit";
import { verifyAuthRequest } from "@/lib/server/verify-auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { uid } = await verifyAuthRequest(request);
    const limited = await enforceApiRateLimits(request, { uid });
    if (limited) return limited;

    const db = getAdminDb();
    const code = await ensureReferralCode(db, uid);

    const referralsSnap = await db
      .collection("referrals")
      .where("referrerUid", "==", uid)
      .get();

    let coinsEarned = 0;
    for (const doc of referralsSnap.docs) {
      const data = doc.data();
      if (data.firstMatchRewarded) coinsEarned += 50;
      if (data.topUpRewarded) coinsEarned += 150;
    }

    return NextResponse.json({
      code,
      referralCount: referralsSnap.size,
      coinsEarned,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not load referral code.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
