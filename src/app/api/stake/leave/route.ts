import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { refundStakeLocksForQueueCancel } from "@/lib/wallet/stake-server";
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

    let queueEntryId: string | undefined;
    try {
      const body = (await request.json()) as { queueEntryId?: string };
      queueEntryId = body.queueEntryId;
    } catch {
      // empty body is fine
    }

    await refundStakeLocksForQueueCancel(getAdminDb(), uid, queueEntryId);
    return NextResponse.json({ refunded: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Stake refund failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
