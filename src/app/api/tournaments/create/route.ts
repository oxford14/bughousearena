import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { createTournament } from "@/lib/wallet/tournament-server";
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
      name?: string;
      description?: string;
      visibility?: "public" | "private";
      pin?: string;
      hostDisplayName?: string;
    };

    if (!body.name?.trim()) {
      return NextResponse.json({ error: "name is required." }, { status: 400 });
    }

    const visibility = body.visibility === "private" ? "private" : "public";
    const db = getAdminDb();
    const hostSnap = await db.collection("users").doc(uid).get();
    const hostDisplayName =
      body.hostDisplayName?.trim() ||
      (hostSnap.data()?.displayName as string) ||
      "Host";

    const result = await createTournament(db, {
      name: body.name.trim(),
      description: body.description,
      hostUid: uid,
      hostDisplayName,
      hostPhotoURL: (hostSnap.data()?.photoURL as string | null) ?? null,
      visibility,
      pin: body.pin,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Create tournament failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
