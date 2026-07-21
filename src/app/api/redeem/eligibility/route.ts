import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { checkRedeemEligibility } from "@/lib/wallet/redeem-server";
import { enforceApiRateLimits } from "@/lib/server/rate-limit";
import { verifyAuthRequest } from "@/lib/server/verify-auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { uid } = await verifyAuthRequest(request);

    const limited = await enforceApiRateLimits(request, {
      uid,
      tier: "redeemEligibility",
    });
    if (limited) return limited;

    const result = await checkRedeemEligibility(getAdminDb(), uid);
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Eligibility check failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
