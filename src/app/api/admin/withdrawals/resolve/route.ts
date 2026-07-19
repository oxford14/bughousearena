import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { processRedemptionRequest } from "@/lib/wallet/redeem-server";
import { verifySuperAdminRequest } from "@/lib/server/verify-super-admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await verifySuperAdminRequest(request);
    const { requestId, action, adminNote } = (await request.json()) as {
      requestId?: string;
      action?: "paid" | "reject";
      adminNote?: string;
    };

    if (!requestId || !action) {
      return NextResponse.json(
        { error: "requestId and action are required." },
        { status: 400 }
      );
    }

    await processRedemptionRequest(getAdminDb(), requestId, action, adminNote);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to resolve withdrawal.";
    const status = message.includes("admin") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
