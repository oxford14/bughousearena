import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { processRedemptionRequest } from "@/lib/wallet/redeem-server";
import { enforceApiRateLimits } from "@/lib/server/rate-limit";
import {
  adminResolveBodySchema,
  zodErrorMessage,
} from "@/lib/server/schemas/api-bodies";
import { verifySuperAdminRequest } from "@/lib/server/verify-super-admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { uid } = await verifySuperAdminRequest(request);

    const limited = await enforceApiRateLimits(request, {
      uid,
      tier: "admin",
    });
    if (limited) return limited;

    const parsed = adminResolveBodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: zodErrorMessage(parsed.error) },
        { status: 400 }
      );
    }
    const { requestId, action, adminNote } = parsed.data;

    await processRedemptionRequest(getAdminDb(), requestId, action, adminNote);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to resolve withdrawal.";
    const status = message.includes("admin") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
