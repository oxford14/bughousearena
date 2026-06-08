import { NextResponse } from "next/server";
import { processPaidCoinCheckoutSession } from "@/lib/paymongo-process-coin-checkout";
import {
  getPurchaseStatusForUser,
} from "@/lib/paymongo-coin-fulfillment";
import { getAdminDb } from "@/lib/firebase-admin";
import { verifyAuthRequest } from "@/lib/server/verify-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const secretKey = process.env.PAYMONGO_SECRET_KEY;
    if (!secretKey) {
      return NextResponse.json(
        { error: "PayMongo is not configured." },
        { status: 500 }
      );
    }

    const { uid } = await verifyAuthRequest(request);
    const body = (await request.json()) as {
      purchaseId?: string;
      sessionId?: string;
    };

    const purchaseId = body.purchaseId;
    if (!purchaseId || typeof purchaseId !== "string") {
      return NextResponse.json({ error: "purchaseId is required." }, { status: 400 });
    }

    const existing = await getPurchaseStatusForUser(purchaseId, uid);
    if (existing.status === "paid") {
      return NextResponse.json({
        status: "paid",
        coins: existing.coinsCredited,
        baseCoins: existing.baseCoins,
        bonusCoins: existing.bonusCoins,
        packId: existing.packId,
        processed: true,
        duplicate: true,
      });
    }

    let sessionId = body.sessionId;
    if (!sessionId) {
      const snap = await getAdminDb()
        .collection("coinPurchases")
        .doc(purchaseId)
        .get();
      sessionId = snap.data()?.paymongoCheckoutSessionId as string | undefined;
    }

    if (sessionId) {
      const result = await processPaidCoinCheckoutSession(sessionId, secretKey, {
        expectedUid: uid,
      });

      if (!result.processed) {
        return NextResponse.json({
          status: "pending",
          message: result.message ?? "Payment not completed yet.",
        });
      }

      const status = await getPurchaseStatusForUser(purchaseId, uid);
      return NextResponse.json({
        status: "paid",
        coins: status.coinsCredited,
        baseCoins: status.baseCoins,
        bonusCoins: status.bonusCoins,
        packId: status.packId,
        processed: true,
        duplicate: result.duplicate,
      });
    }

    return NextResponse.json({
      status: "pending",
      message: "Payment not completed yet.",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to confirm payment.";
    console.error("[PayMongo Confirm]", message);
    const status = message === "Must be signed in." ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
