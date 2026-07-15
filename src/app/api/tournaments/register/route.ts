import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { registerTournamentTeam } from "@/lib/wallet/tournament-server";
import { verifyAuthRequest } from "@/lib/server/verify-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { uid } = await verifyAuthRequest(request);
    const body = (await request.json()) as {
      tournamentId?: string;
      partnerUid?: string;
      teamName?: string;
    };

    if (!body.tournamentId || !body.partnerUid) {
      return NextResponse.json(
        { error: "tournamentId and partnerUid are required." },
        { status: 400 }
      );
    }

    const result = await registerTournamentTeam(
      getAdminDb(),
      body.tournamentId,
      uid,
      body.partnerUid,
      body.teamName ?? ""
    );
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Registration failed.";
    const status = message.includes("enough") ? 412 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
