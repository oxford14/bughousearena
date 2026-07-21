import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { advanceTournamentOnMatchComplete } from "@/lib/wallet/tournament-server";
import { enforceApiRateLimits } from "@/lib/server/rate-limit";
import { verifyAuthRequest } from "@/lib/server/verify-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { uid } = await verifyAuthRequest(request);
    const limited = await enforceApiRateLimits(request, { uid });
    if (limited) return limited;

    const { matchId } = (await request.json()) as { matchId?: string };
    if (!matchId) {
      return NextResponse.json({ error: "matchId is required." }, { status: 400 });
    }

    const db = getAdminDb();
    const matchSnap = await db.collection("matches").doc(matchId).get();
    if (!matchSnap.exists) {
      return NextResponse.json({ error: "Match not found." }, { status: 404 });
    }

    const match = matchSnap.data()!;
    const playerUids = (match.playerUids as string[]) ?? [];
    if (!playerUids.includes(uid)) {
      return NextResponse.json({ error: "Not a match participant." }, { status: 403 });
    }

    if (match.status !== "completed" || !match.winnerTeam) {
      return NextResponse.json({ error: "Match not completed." }, { status: 400 });
    }

    const tournamentId = match.tournamentId as string | undefined;
    if (!tournamentId) {
      return NextResponse.json({ advanced: false });
    }

    const team1Id = match.tournamentTeam1Id as string;
    const team2Id = match.tournamentTeam2Id as string;
    const winnerTeamId = match.winnerTeam === 1 ? team1Id : team2Id;

    await advanceTournamentOnMatchComplete(
      db,
      tournamentId,
      matchId,
      winnerTeamId
    );

    return NextResponse.json({ advanced: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Advance tournament failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
