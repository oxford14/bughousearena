import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { claimDailyBonus } from "@/lib/wallet/daily-bonus";
import { verifyAuthRequest } from "@/lib/server/verify-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { uid } = await verifyAuthRequest(request);
    const result = await claimDailyBonus(getAdminDb(), uid);
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Daily claim failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
