import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { leaveTournamentRoom } from "@/lib/wallet/tournament-server";
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

    const body = (await request.json()) as { tournamentId?: string };
    if (!body.tournamentId) {
      return NextResponse.json(
        { error: "tournamentId is required." },
        { status: 400 }
      );
    }

    const result = await leaveTournamentRoom(
      getAdminDb(),
      body.tournamentId,
      uid
    );
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Leave failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
