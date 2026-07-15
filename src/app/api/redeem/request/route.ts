import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import {
  checkRedeemEligibility,
  createRedemptionRequest,
} from "@/lib/wallet/redeem-server";
import { verifyAuthRequest } from "@/lib/server/verify-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { uid } = await verifyAuthRequest(request);
    const authUser = await getAdminAuth().getUser(uid);
    const body = (await request.json()) as {
      bundleId?: string;
      gcashNumber?: string;
      gcashName?: string;
    };

    if (!body.bundleId || !body.gcashNumber || !body.gcashName) {
      return NextResponse.json(
        { error: "bundleId, gcashNumber, and gcashName are required." },
        { status: 400 }
      );
    }

    const result = await createRedemptionRequest(
      getAdminDb(),
      uid,
      body.bundleId,
      body.gcashNumber,
      body.gcashName,
      authUser.emailVerified
    );
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Redemption request failed.";
    const status = message.includes("Not enough") ? 412 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
