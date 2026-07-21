import { NextResponse } from "next/server";
import { getCoinPack } from "@/lib/shop/coin-packs";
import { createPaymongoCheckoutSession } from "@/lib/paymongo";
import {
  attachCheckoutSessionToPurchase,
  createPendingCoinPurchase,
} from "@/lib/paymongo-process-coin-checkout";
import { getSafeAppOrigin } from "@/lib/server/app-origin";
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

    const { uid, email, name } = await verifyAuthRequest(request);

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
      const session = await createPaymongoCheckoutSession({
        secretKey,
        packLabel: `${pack.coins} Arena Coins`,
        amountCentavos: pack.amountCentavos,
        purchaseId,
        referenceNumber,
        uid,
        packId: pack.id,
        origin: getSafeAppOrigin(request),
        billingEmail: email,
        billingName: name,
      });

      await attachCheckoutSessionToPurchase(
        purchaseId,
        session.checkoutSessionId
      );

      return NextResponse.json({
        checkoutUrl: session.checkoutUrl,
        purchaseId,
        sessionId: session.checkoutSessionId,
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
      error instanceof Error ? error.message : "Could not start checkout.";
    console.error("[PayMongo Create Checkout]", message);
    const status = message === "Must be signed in." ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
