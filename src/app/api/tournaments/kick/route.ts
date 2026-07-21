import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { kickTournamentMember } from "@/lib/wallet/tournament-server";
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

    const body = (await request.json()) as {
      tournamentId?: string;
      targetUid?: string;
      /** @deprecated Prefer targetUid */
      teamId?: string;
    };
    if (!body.tournamentId || !body.targetUid) {
      return NextResponse.json(
        { error: "tournamentId and targetUid are required." },
        { status: 400 }
      );
    }

    await kickTournamentMember(
      getAdminDb(),
      body.tournamentId,
      body.targetUid,
      uid
    );
    return NextResponse.json({ kicked: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Kick failed.";
    const status = message.includes("host") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
