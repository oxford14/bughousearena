import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import {
  startTournamentBracket,
  spawnBracketMatches,
} from "@/lib/wallet/tournament-server";
import { enforceApiRateLimits } from "@/lib/server/rate-limit";
import { verifyAdminRequest } from "@/lib/server/verify-admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { uid } = await verifyAdminRequest(request);
    const limited = await enforceApiRateLimits(request, {
      uid,
      tier: "admin",
    });
    if (limited) return limited;

    const { tournamentId } = (await request.json()) as { tournamentId?: string };
    if (!tournamentId) {
      return NextResponse.json({ error: "tournamentId is required." }, { status: 400 });
    }

    const db = getAdminDb();
    await startTournamentBracket(db, tournamentId);
    await spawnBracketMatches(db, tournamentId, 1);
    return NextResponse.json({ started: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Start bracket failed.";
    const status = message.includes("Admin") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
