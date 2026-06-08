import { NextResponse } from "next/server";
import { verifyPaymongoSignature } from "@/lib/paymongo";
import { processPaidCoinCheckoutSession } from "@/lib/paymongo-process-coin-checkout";
import { getAdminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";

const HANDLED_EVENTS = new Set([
  "checkout_session.payment.paid",
]);

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

export async function POST(request: Request) {
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

  if (webhookSecret) {
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
  } else {
    console.warn(
      "[PayMongo Webhook] PAYMONGO_WEBHOOK_SECRET not set — skipping signature check"
    );
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
