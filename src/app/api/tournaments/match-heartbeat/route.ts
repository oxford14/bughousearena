import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { recordTournamentHeartbeat } from "@/lib/wallet/tournament-server";
import { enforceApiRateLimits } from "@/lib/server/rate-limit";
import { verifyAuthRequest } from "@/lib/server/verify-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { uid } = await verifyAuthRequest(request);
    const limited = await enforceApiRateLimits(request, { uid });
    if (limited) return limited;

    const body = (await request.json()) as { matchId?: string };
    if (!body.matchId) {
      return NextResponse.json({ error: "matchId is required." }, { status: 400 });
    }

    await recordTournamentHeartbeat(getAdminDb(), body.matchId, uid);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Heartbeat failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
