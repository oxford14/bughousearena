import { NextResponse } from "next/server";
import { getCoinPack } from "@/lib/shop/coin-packs";
import { createPaymongoQrph } from "@/lib/paymongo";
import {
  attachPaymentIntentToPurchase,
  createPendingCoinPurchase,
} from "@/lib/paymongo-process-coin-checkout";
import { enforceApiRateLimits } from "@/lib/server/rate-limit";
import {
  packIdBodySchema,
  zodErrorMessage,
} from "@/lib/server/schemas/api-bodies";
import { verifyAuthRequest } from "@/lib/server/verify-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const secretKey = process.env.PAYMONGO_SECRET_KEY;
    if (!secretKey) {
      throw new Error("PayMongo secret key is not configured.");
    }

    const { uid } = await verifyAuthRequest(request);

    const limited = await enforceApiRateLimits(request, {
      uid,
      tier: "topupCreate",
    });
    if (limited) return limited;

    const parsed = packIdBodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: zodErrorMessage(parsed.error) },
        { status: 400 }
      );
    }
    const { packId } = parsed.data;

    const pack = getCoinPack(packId);
    if (!pack) {
      throw new Error("Unknown coin pack.");
    }

    const { purchaseId, referenceNumber } = await createPendingCoinPurchase(
      uid,
      pack
    );

    try {
      const qr = await createPaymongoQrph({
        secretKey,
        amountCentavos: pack.amountCentavos,
        description: `${pack.coins} Arena Coins`,
        referenceNumber,
        uid,
        packId: pack.id,
        purchaseId,
      });

      await attachPaymentIntentToPurchase(purchaseId, qr.paymentIntentId);

      return NextResponse.json({
        purchaseId,
        paymentIntentId: qr.paymentIntentId,
        qrImageUrl: qr.qrImageUrl,
        expiresAt: qr.expiresAt,
        referenceNumber,
        amountCentavos: pack.amountCentavos,
      });
    } catch (error) {
      const { getAdminDb } = await import("@/lib/firebase-admin");
      await getAdminDb().collection("coinPurchases").doc(purchaseId).update({
        status: "failed",
      });
      throw error;
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not start QR Ph payment.";
    console.error("[PayMongo Create QRPh]", message);
    const status = message === "Must be signed in." ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
