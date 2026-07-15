import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { refundStakeLock } from "@/lib/wallet/stake-server";
import { verifyAuthRequest } from "@/lib/server/verify-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { uid } = await verifyAuthRequest(request);
    await refundStakeLock(getAdminDb(), uid, "queue_cancel");
    return NextResponse.json({ refunded: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Stake refund failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
