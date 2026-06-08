import { createHmac, timingSafeEqual } from "node:crypto";
import type { CoinPack } from "./coin-packs";

const PAYMONGO_API = "https://api.paymongo.com/v2";

export interface CheckoutSessionResult {
  checkoutSessionId: string;
  checkoutUrl: string;
}

export function getPaymongoSecretKey(): string {
  const key = process.env.PAYMONGO_SECRET_KEY;
  if (!key) {
    throw new Error("PAYMONGO_SECRET_KEY is not configured.");
  }
  return key;
}

export function getPaymongoWebhookSecret(): string {
  const secret = process.env.PAYMONGO_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("PAYMONGO_WEBHOOK_SECRET is not configured.");
  }
  return secret;
}

export function getAppUrl(): string {
  return process.env.APP_URL ?? "http://localhost:3000";
}

export async function createPaymongoCheckoutSession(params: {
  pack: CoinPack;
  purchaseId: string;
  referenceNumber: string;
  uid: string;
  billingEmail?: string;
  billingName?: string;
}): Promise<CheckoutSessionResult> {
  const secretKey = getPaymongoSecretKey();
  const appUrl = getAppUrl();
  const auth = Buffer.from(`${secretKey}:`).toString("base64");

  const body = {
    data: {
      attributes: {
        billing: {
          name: params.billingName?.trim() || "Bughouse Arena Player",
          email: params.billingEmail?.trim() || "player@bughousearena.com",
        },
        line_items: [
          {
            currency: "PHP",
            amount: params.pack.amountCentavos,
            name: params.pack.label,
            quantity: 1,
          },
        ],
        payment_method_types: ["card", "gcash", "qrph"],
        reference_number: params.referenceNumber,
        success_url: `${appUrl}/app/shop/success?purchase=${params.purchaseId}`,
        cancel_url: `${appUrl}/app/home?shop=cancelled`,
        metadata: {
          uid: params.uid,
          packId: params.pack.id,
          purchaseId: params.purchaseId,
        },
      },
    },
  };

  const response = await fetch(`${PAYMONGO_API}/checkout_sessions`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const json = (await response.json()) as {
    data?: {
      id: string;
      attributes?: { checkout_url?: string };
    };
    errors?: Array<{ detail?: string }>;
  };

  if (!response.ok) {
    const detail =
      json.errors?.map((e) => e.detail).filter(Boolean).join("; ") ??
      "PayMongo checkout creation failed.";
    throw new Error(detail);
  }

  const checkoutSessionId = json.data?.id;
  const checkoutUrl = json.data?.attributes?.checkout_url;
  if (!checkoutSessionId || !checkoutUrl) {
    throw new Error("PayMongo returned an incomplete checkout session.");
  }

  return { checkoutSessionId, checkoutUrl };
}

export function verifyPaymongoSignature(
  rawBody: Buffer,
  signatureHeader: string | undefined
): boolean {
  if (!signatureHeader) return false;

  const webhookSecret = getPaymongoWebhookSecret();
  const parts = Object.fromEntries(
    signatureHeader.split(",").map((part) => {
      const [key, ...rest] = part.split("=");
      return [key?.trim(), rest.join("=")];
    })
  );

  const timestamp = parts.t;
  const signature = parts.te ?? parts.li;
  if (!timestamp || !signature) return false;

  const payload = `${timestamp}.${rawBody.toString("utf8")}`;
  const expected = createHmac("sha256", webhookSecret)
    .update(payload)
    .digest("hex");

  try {
    return timingSafeEqual(
      Buffer.from(signature, "hex"),
      Buffer.from(expected, "hex")
    );
  } catch {
    return false;
  }
}

export interface PaymongoWebhookEvent {
  type: string;
  metadata?: Record<string, unknown>;
  referenceNumber?: string;
}

export function parsePaymongoWebhookEvent(
  body: unknown
): PaymongoWebhookEvent | null {
  if (!body || typeof body !== "object") return null;

  const root = body as {
    data?: {
      attributes?: {
        type?: string;
        data?: {
          attributes?: {
            metadata?: Record<string, unknown>;
            reference_number?: string;
          };
        };
      };
    };
  };

  const attributes = root.data?.attributes;
  if (!attributes?.type) return null;

  const sessionAttributes = attributes.data?.attributes;
  return {
    type: attributes.type,
    metadata: sessionAttributes?.metadata,
    referenceNumber: sessionAttributes?.reference_number,
  };
}
