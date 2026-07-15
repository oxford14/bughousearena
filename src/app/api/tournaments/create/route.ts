import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { createTournament } from "@/lib/wallet/tournament-server";
import { verifyAdminRequest } from "@/lib/server/verify-admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await verifyAdminRequest(request);
    const body = (await request.json()) as {
      name?: string;
      description?: string;
      registrationFeeCoins?: number;
      startsAt?: string;
    };

    if (!body.name?.trim() || !body.registrationFeeCoins || !body.startsAt) {
      return NextResponse.json(
        { error: "name, registrationFeeCoins, and startsAt are required." },
        { status: 400 }
      );
    }

    const tournamentId = await createTournament(getAdminDb(), {
      name: body.name.trim(),
      description: body.description,
      registrationFeeCoins: body.registrationFeeCoins,
      startsAt: new Date(body.startsAt),
    });

    return NextResponse.json({ tournamentId });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Create tournament failed.";
    const status = message.includes("Admin") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
