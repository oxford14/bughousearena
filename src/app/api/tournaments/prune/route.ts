import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import {
  pruneTournamentRegistration,
  checkTournamentForfeits,
} from "@/lib/wallet/tournament-server";
import { enforceApiRateLimits } from "@/lib/server/rate-limit";
import { verifyAuthRequest } from "@/lib/server/verify-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { uid } = await verifyAuthRequest(request);
    const limited = await enforceApiRateLimits(request, { uid });
    if (limited) return limited;

    const body = (await request.json()) as { tournamentId?: string };
    if (!body.tournamentId) {
      return NextResponse.json(
        { error: "tournamentId is required." },
        { status: 400 }
      );
    }

    const db = getAdminDb();
    const tournamentSnap = await db
      .collection("tournaments")
      .doc(body.tournamentId)
      .get();
    if (!tournamentSnap.exists) {
      return NextResponse.json({ error: "Tournament not found." }, { status: 404 });
    }

    const status = tournamentSnap.data()!.status as string;
    if (status === "registration") {
      const result = await pruneTournamentRegistration(db, body.tournamentId);
      return NextResponse.json({ pruned: result.removed, forfeited: 0 });
    }

    if (status === "active") {
      const forfeited = await checkTournamentForfeits(db, body.tournamentId);
      return NextResponse.json({ pruned: 0, forfeited });
    }

    return NextResponse.json({ pruned: 0, forfeited: 0 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Prune failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
