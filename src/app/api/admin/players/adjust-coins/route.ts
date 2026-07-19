import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { creditCoins, debitCoins, WalletError } from "@/lib/wallet/wallet-server";
import { verifySuperAdminRequest } from "@/lib/server/verify-super-admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { uid: adminUid } = await verifySuperAdminRequest(request);
    const { uid, amount, reason } = (await request.json()) as {
      uid?: string;
      amount?: number;
      reason?: string;
    };

    if (!uid || typeof amount !== "number" || !Number.isFinite(amount) || amount === 0) {
      return NextResponse.json(
        { error: "uid and a non-zero amount are required." },
        { status: 400 }
      );
    }

    const db = getAdminDb();
    const refId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const metadata = { reason: reason ?? null, by: adminUid };

    const result =
      amount > 0
        ? await creditCoins(db, {
            uid,
            amount,
            type: "admin_adjust",
            refId,
            metadata,
          })
        : await debitCoins(db, {
            uid,
            amount,
            type: "admin_adjust",
            refId,
            metadata,
          });

    return NextResponse.json({ balanceAfter: result.balanceAfter });
  } catch (error) {
    if (error instanceof WalletError && error.code === "INSUFFICIENT_FUNDS") {
      return NextResponse.json(
        { error: "Player does not have enough coins for this deduction." },
        { status: 400 }
      );
    }
    const message =
      error instanceof Error ? error.message : "Failed to adjust coins.";
    const status = message.includes("admin") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
