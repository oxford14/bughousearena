import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { applyReferralCode } from "@/lib/wallet/referral-server";
import { enforceApiRateLimits } from "@/lib/server/rate-limit";
import { verifyAuthRequest } from "@/lib/server/verify-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { uid } = await verifyAuthRequest(request);
    const limited = await enforceApiRateLimits(request, {
      uid,
      tier: "walletMutation",
    });
    if (limited) return limited;

    const { code } = (await request.json()) as { code?: string };
    if (!code?.trim()) {
      return NextResponse.json({ error: "Referral code is required." }, { status: 400 });
    }
    const result = await applyReferralCode(getAdminDb(), uid, code);
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not apply referral.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
