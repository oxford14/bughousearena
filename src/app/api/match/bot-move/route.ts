import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { verifyAuthRequest } from "@/lib/server/verify-auth";
import { submitValidatedMoveAdmin } from "@/lib/game/match-move-admin";
import type { PieceSymbol } from "@/lib/game/bughouse-engine";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { uid } = await verifyAuthRequest(request);
    const body = (await request.json()) as {
      matchId?: string;
      boardId?: string;
      playerId?: string;
      move?: string;
      promotion?: PieceSymbol;
    };

    const { matchId, boardId, playerId, move, promotion } = body;
    if (!matchId || !boardId || !playerId || !move) {
      return NextResponse.json({ error: "Missing move parameters." }, { status: 400 });
    }

    const result = await submitValidatedMoveAdmin(
      getAdminDb(),
      { matchId, boardId, playerId, move, promotion },
      uid
    );

    if (!result.ok) {
      return NextResponse.json({ error: result.error ?? "Move rejected." }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bot move failed.";
    console.error("[Bot Move]", message);
    const status = message === "Must be signed in." ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
