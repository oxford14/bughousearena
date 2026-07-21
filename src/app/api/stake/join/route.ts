import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { lockStakeForQueueEntry } from "@/lib/wallet/stake-server";
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

    const { stakeAmount, queueEntryId } = (await request.json()) as {
      stakeAmount?: number;
      queueEntryId?: string;
    };

    if (!stakeAmount || !queueEntryId) {
      return NextResponse.json(
        { error: "stakeAmount and queueEntryId are required." },
        { status: 400 }
      );
    }

    const result = await lockStakeForQueueEntry(
      getAdminDb(),
      uid,
      stakeAmount,
      queueEntryId
    );
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Stake lock failed.";
    const status = message.includes("Not enough") || message.includes("does not have enough")
      ? 412
      : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
