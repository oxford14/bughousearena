import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { removePlayerFromOpenTournaments } from "@/lib/wallet/tournament-server";
import { enforceApiRateLimits } from "@/lib/server/rate-limit";
import { verifyAuthRequest } from "@/lib/server/verify-auth";

export const runtime = "nodejs";

/** Called when a player starts another game / joins queue. */
export async function POST(request: Request) {
  try {
    const { uid } = await verifyAuthRequest(request);
    const limited = await enforceApiRateLimits(request, { uid });
    if (limited) return limited;

    const removed = await removePlayerFromOpenTournaments(getAdminDb(), uid);
    return NextResponse.json({ removed });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Clear registration failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
