import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { createRedemptionRequest } from "@/lib/wallet/redeem-server";
import { enforceApiRateLimits } from "@/lib/server/rate-limit";
import {
  redeemRequestBodySchema,
  zodErrorMessage,
} from "@/lib/server/schemas/api-bodies";
import { verifyAuthRequest } from "@/lib/server/verify-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { uid } = await verifyAuthRequest(request);

    const limited = await enforceApiRateLimits(request, {
      uid,
      tier: "redeemRequest",
    });
    if (limited) return limited;

    const parsed = redeemRequestBodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: zodErrorMessage(parsed.error) },
        { status: 400 }
      );
    }
    const { bundleId, gcashNumber, gcashName, bankName } = parsed.data;
    const payoutMethod = parsed.data.payoutMethod;
    const accountName = (
      parsed.data.accountName ??
      gcashName ??
      ""
    ).trim();
    const accountNumber = (
      parsed.data.accountNumber ??
      gcashNumber ??
      ""
    ).trim();

    const result = await createRedemptionRequest(getAdminDb(), uid, {
      bundleId,
      payoutMethod,
      accountName,
      accountNumber,
      bankName,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Redemption request failed.";
    const status = message.includes("Not enough") ? 412 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
