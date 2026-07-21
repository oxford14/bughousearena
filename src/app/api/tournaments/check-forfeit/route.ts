import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { checkTournamentDisconnectForfeit } from "@/lib/wallet/tournament-server";
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

    const db = getAdminDb();
    const matchSnap = await db.collection("matches").doc(body.matchId).get();
    if (!matchSnap.exists) {
      return NextResponse.json({ error: "Match not found." }, { status: 404 });
    }

    const match = matchSnap.data()!;
    const playerUids = (match.playerUids as string[]) ?? [];
    const isParticipant = playerUids.includes(uid);

    let isHost = false;
    if (match.tournamentId) {
      const tSnap = await db
        .collection("tournaments")
        .doc(match.tournamentId as string)
        .get();
      isHost = tSnap.data()?.hostUid === uid;
    }

    if (!isParticipant && !isHost) {
      return NextResponse.json({ error: "Not allowed." }, { status: 403 });
    }

    const result = await checkTournamentDisconnectForfeit(db, body.matchId);
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Forfeit check failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
