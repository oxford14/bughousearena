import { NextResponse } from "next/server";
import { verifyPaymongoSignature } from "@/lib/paymongo";
import {
  processPaidCoinCheckoutSession,
  processPaidQrphIntent,
} from "@/lib/paymongo-process-coin-checkout";
import { getAdminDb } from "@/lib/firebase-admin";
import { enforceApiRateLimits } from "@/lib/server/rate-limit";
import {
  markRedemptionFailedByTransfer,
  markRedemptionPaidByTransfer,
} from "@/lib/wallet/redeem-server";

export const runtime = "nodejs";

const HANDLED_EVENTS = new Set([
  "checkout_session.payment.paid",
  "payment.paid",
  "transfer.outward.successful",
  "transfer.outward.failed",
]);

function extractTransferId(payload: Record<string, unknown>): string | null {
  const data = payload?.data as {
    attributes?: { data?: { id?: string } };
  };
  return data?.attributes?.data?.id ?? null;
}

async function markEventProcessed(eventId: string): Promise<boolean> {
  const db = getAdminDb();
  const ref = db.collection("paymongoWebhookEvents").doc(eventId);
  const existing = await ref.get();
  if (existing.exists) return false;
  await ref.set({ processedAt: new Date().toISOString() });
  return true;
}

function extractCheckoutSessionId(payload: Record<string, unknown>): string | null {
  const data = payload?.data as {
    attributes?: {
      type?: string;
      data?: { id?: string; type?: string };
    };
  };
  const attrs = data?.attributes;
  const inner = attrs?.data;
  if (!inner?.id) return null;

  if (
    inner.type === "checkout_session" ||
    attrs?.type === "checkout_session.payment.paid"
  ) {
    return inner.id;
  }
  return null;
}

function extractPaymentIntentId(payload: Record<string, unknown>): string | null {
  const data = payload?.data as {
    attributes?: {
      data?: { attributes?: { payment_intent_id?: string } };
    };
  };
  return data?.attributes?.data?.attributes?.payment_intent_id ?? null;
}

export async function POST(request: Request) {
  const limited = await enforceApiRateLimits(request, { tier: "webhook" });
  if (limited) return limited;

  const rawBody = await request.text();
  const webhookSecret = process.env.PAYMONGO_WEBHOOK_SECRET;
  const secretKey = process.env.PAYMONGO_SECRET_KEY;

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventType = (payload?.data as { attributes?: { type?: string } })
    ?.attributes?.type;
  const eventId = (payload?.data as { id?: string })?.id;
  const livemode =
    (payload?.data as { attributes?: { livemode?: boolean } })?.attributes
      ?.livemode ?? false;

  if (!eventType || !eventId) {
    return NextResponse.json({ error: "Invalid webhook payload" }, { status: 400 });
  }

  if (!HANDLED_EVENTS.has(eventType)) {
    return NextResponse.json({ received: true, skipped: eventType });
  }

  if (!webhookSecret) {
    if (process.env.NODE_ENV === "production") {
      console.error(
        "[PayMongo Webhook] PAYMONGO_WEBHOOK_SECRET not set — rejecting in production"
      );
      return NextResponse.json(
        { error: "Webhook secret not configured." },
        { status: 500 }
      );
    }
    console.warn(
      "[PayMongo Webhook] PAYMONGO_WEBHOOK_SECRET not set — skipping signature check (non-production)"
    );
  } else {
    const signature = request.headers.get("paymongo-signature");
    const valid = verifyPaymongoSignature(
      rawBody,
      signature,
      webhookSecret,
      livemode
    );
    if (!valid) {
      console.error("[PayMongo Webhook] Invalid signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  const shouldProcess = await markEventProcessed(eventId);
  if (!shouldProcess) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  if (!secretKey) {
    console.error("[PayMongo Webhook] PAYMONGO_SECRET_KEY not configured");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  try {
    if (
      eventType === "transfer.outward.successful" ||
      eventType === "transfer.outward.failed"
    ) {
      const transferId = extractTransferId(payload);
      if (!transferId) {
        return NextResponse.json({ received: true, warning: "no_transfer_id" });
      }
      if (eventType === "transfer.outward.successful") {
        const done = await markRedemptionPaidByTransfer(getAdminDb(), transferId);
        return NextResponse.json({ received: true, processed: done, transferId });
      }
      const refunded = await markRedemptionFailedByTransfer(
        getAdminDb(),
        transferId,
        "PayMongo reported the transfer failed."
      );
      return NextResponse.json({ received: true, refunded, transferId });
    }

    if (eventType === "payment.paid") {
      const paymentIntentId = extractPaymentIntentId(payload);
      if (!paymentIntentId) {
        return NextResponse.json({ received: true, warning: "no_payment_intent" });
      }

      try {
        const result = await processPaidQrphIntent(paymentIntentId, secretKey);
        if (!result.processed) {
          return NextResponse.json({ received: true, warning: result.message });
        }
        return NextResponse.json({
          received: true,
          processed: true,
          paymentIntentId,
          duplicate: result.duplicate,
        });
      } catch (error) {
        // Hosted-checkout payments also fire payment.paid but their intent
        // carries no purchase metadata — safely skip those (already handled
        // by checkout_session.payment.paid).
        const message = error instanceof Error ? error.message : "";
        if (message.includes("missing purchase metadata")) {
          return NextResponse.json({ received: true, skipped: "non_qrph_payment" });
        }
        throw error;
      }
    }

    const sessionId = extractCheckoutSessionId(payload);
    if (!sessionId) {
      console.warn("[PayMongo Webhook] No checkout session in event");
      return NextResponse.json({ received: true, warning: "no_checkout_session" });
    }

    const result = await processPaidCoinCheckoutSession(sessionId, secretKey);
    if (!result.processed) {
      return NextResponse.json({ received: true, warning: result.message });
    }

    return NextResponse.json({
      received: true,
      processed: true,
      sessionId,
      duplicate: result.duplicate,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Webhook processing failed";
    console.error("[PayMongo Webhook]", message);

    try {
      await getAdminDb()
        .collection("paymongoWebhookEvents")
        .doc(eventId)
        .delete();
    } catch {
      /* allow PayMongo retry */
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
