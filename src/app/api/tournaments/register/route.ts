import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { joinTournamentRoom } from "@/lib/wallet/tournament-server";
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
      pin?: string;
      slotIndex?: number;
    };

    if (!body.tournamentId) {
      return NextResponse.json(
        { error: "tournamentId is required." },
        { status: 400 }
      );
    }

    if (
      typeof body.slotIndex !== "number" ||
      !Number.isInteger(body.slotIndex) ||
      body.slotIndex < 0 ||
      body.slotIndex > 15
    ) {
      return NextResponse.json(
        { error: "slotIndex (0–15) is required." },
        { status: 400 }
      );
    }

    const result = await joinTournamentRoom(
      getAdminDb(),
      body.tournamentId,
      uid,
      body.pin,
      body.slotIndex
    );
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Join room failed.";
    const status =
      message.includes("coins") || message.includes("PIN") ? 412 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
