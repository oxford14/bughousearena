import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { checkRedeemEligibility } from "@/lib/wallet/redeem-server";
import { verifyAuthRequest } from "@/lib/server/verify-auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { uid } = await verifyAuthRequest(request);
    const authUser = await getAdminAuth().getUser(uid);
    const result = await checkRedeemEligibility(
      getAdminDb(),
      uid,
      authUser.emailVerified
    );
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Eligibility check failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
