import crypto from "crypto";

export function verifyPaymongoSignature(
  rawBody: string,
  signatureHeader: string | null,
  webhookSecret: string,
  livemode: boolean
): boolean {
  if (!signatureHeader || !webhookSecret) return false;

  const parts: Record<string, string> = {};
  for (const segment of signatureHeader.split(",")) {
    const eq = segment.indexOf("=");
    if (eq === -1) continue;
    parts[segment.slice(0, eq).trim()] = segment.slice(eq + 1);
  }

  const timestamp = parts.t;
  const expected = livemode ? parts.li : parts.te;
  if (!timestamp || !expected) return false;

  const signedPayload = `${timestamp}.${rawBody}`;
  const computed = crypto
    .createHmac("sha256", webhookSecret)
    .update(signedPayload)
    .digest("hex");

  try {
    const a = Buffer.from(computed, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return computed === expected;
  }
}

export type PaymongoCheckoutSessionDetails = {
  status: "paid" | "pending";
  metadata: Record<string, string>;
  amountCentavos: number;
};

function checkoutSessionIsPaid(attrs: Record<string, unknown>): boolean {
  const status = String(attrs.status ?? "").toLowerCase();
  if (status === "paid" || status === "complete" || status === "succeeded") {
    return true;
  }

  const payments = attrs.payments as
    | Array<{ attributes?: { status?: string }; status?: string }>
    | undefined;
  return (
    payments?.some((payment) => {
      const paymentStatus = (
        payment.attributes?.status ?? payment.status ?? ""
      ).toLowerCase();
      return paymentStatus === "paid" || paymentStatus === "succeeded";
    }) ?? false
  );
}

export async function fetchPaymongoCheckoutSession(
  sessionId: string,
  secretKey: string
): Promise<PaymongoCheckoutSessionDetails | null> {
  const authString = Buffer.from(`${secretKey}:`).toString("base64");
  const response = await fetch(
    `https://api.paymongo.com/v1/checkout_sessions/${sessionId}`,
    {
      headers: {
        accept: "application/json",
        authorization: `Basic ${authString}`,
      },
    }
  );

  const data = (await response.json()) as {
    data?: { attributes?: Record<string, unknown> };
    errors?: Array<{ detail?: string }>;
  };

  if (!response.ok || !data?.data?.attributes) {
    console.error("[PayMongo] Failed to fetch checkout session:", sessionId, data?.errors);
    return null;
  }

  const attrs = data.data.attributes;
  const lineItems = attrs.line_items as
    | Array<{ amount?: number; quantity?: number }>
    | undefined;
  const amountCentavos =
    lineItems?.reduce(
      (sum, item) => sum + (item.amount ?? 0) * (item.quantity ?? 1),
      0
    ) ?? 0;

  const metadata: Record<string, string> = {};
  if (attrs.metadata && typeof attrs.metadata === "object") {
    for (const [key, value] of Object.entries(attrs.metadata)) {
      metadata[key] = String(value);
    }
  }

  return {
    status: checkoutSessionIsPaid(attrs) ? "paid" : "pending",
    metadata,
    amountCentavos,
  };
}

export type PaymongoPaymentIntentDetails = {
  status: "paid" | "pending";
  metadata: Record<string, string>;
  amountCentavos: number;
};

function paymentIntentIsPaid(attrs: Record<string, unknown>): boolean {
  const status = String(attrs.status ?? "").toLowerCase();
  return status === "succeeded" || status === "paid";
}

export async function fetchPaymongoPaymentIntent(
  paymentIntentId: string,
  secretKey: string
): Promise<PaymongoPaymentIntentDetails | null> {
  const authString = Buffer.from(`${secretKey}:`).toString("base64");
  const response = await fetch(
    `https://api.paymongo.com/v1/payment_intents/${paymentIntentId}`,
    {
      headers: {
        accept: "application/json",
        authorization: `Basic ${authString}`,
      },
    }
  );

  const data = (await response.json()) as {
    data?: { attributes?: Record<string, unknown> };
    errors?: Array<{ detail?: string }>;
  };

  if (!response.ok || !data?.data?.attributes) {
    console.error(
      "[PayMongo] Failed to fetch payment intent:",
      paymentIntentId,
      data?.errors
    );
    return null;
  }

  const attrs = data.data.attributes;
  const metadata: Record<string, string> = {};
  if (attrs.metadata && typeof attrs.metadata === "object") {
    for (const [key, value] of Object.entries(attrs.metadata)) {
      metadata[key] = String(value);
    }
  }

  return {
    status: paymentIntentIsPaid(attrs) ? "paid" : "pending",
    metadata,
    amountCentavos: (attrs.amount as number | undefined) ?? 0,
  };
}

function normalizeQrImage(imageUrl: string): string {
  if (imageUrl.startsWith("data:") || imageUrl.startsWith("http")) {
    return imageUrl;
  }
  return `data:image/png;base64,${imageUrl}`;
}

export type PaymongoQrphResult = {
  paymentIntentId: string;
  qrImageUrl: string;
  expiresAt: number | null;
};

/**
 * Creates a dynamic QR Ph code via the Payment Intent workflow:
 * 1. Create payment intent (qrph allowed)
 * 2. Create a qrph payment method
 * 3. Attach it — the response carries the QR image in next_action.code.image_url
 */
export async function createPaymongoQrph(params: {
  secretKey: string;
  amountCentavos: number;
  description: string;
  referenceNumber: string;
  uid: string;
  packId: string;
  purchaseId: string;
}): Promise<PaymongoQrphResult> {
  const authString = Buffer.from(`${params.secretKey}:`).toString("base64");
  const headers = {
    accept: "application/json",
    "Content-Type": "application/json",
    authorization: `Basic ${authString}`,
  };

  const intentResponse = await fetch(
    "https://api.paymongo.com/v1/payment_intents",
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        data: {
          attributes: {
            amount: params.amountCentavos,
            currency: "PHP",
            payment_method_allowed: ["qrph"],
            description: params.description,
            statement_descriptor: "Bughouse Arena",
            metadata: {
              uid: params.uid,
              packId: params.packId,
              purchaseId: params.purchaseId,
              referenceNumber: params.referenceNumber,
            },
          },
        },
      }),
    }
  );

  const intentJson = (await intentResponse.json()) as {
    data?: { id: string; attributes?: { client_key?: string } };
    errors?: Array<{ detail?: string }>;
  };

  if (!intentResponse.ok || intentJson.errors || !intentJson.data?.id) {
    const detail =
      intentJson.errors?.map((e) => e.detail).filter(Boolean).join("; ") ??
      "PayMongo payment intent creation failed.";
    throw new Error(detail);
  }

  const paymentIntentId = intentJson.data.id;
  const clientKey = intentJson.data.attributes?.client_key;
  if (!clientKey) {
    throw new Error("PayMongo payment intent is missing a client key.");
  }

  const methodResponse = await fetch(
    "https://api.paymongo.com/v1/payment_methods",
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        data: { attributes: { type: "qrph" } },
      }),
    }
  );

  const methodJson = (await methodResponse.json()) as {
    data?: { id: string };
    errors?: Array<{ detail?: string }>;
  };

  if (!methodResponse.ok || methodJson.errors || !methodJson.data?.id) {
    const detail =
      methodJson.errors?.map((e) => e.detail).filter(Boolean).join("; ") ??
      "PayMongo QR Ph payment method creation failed.";
    throw new Error(detail);
  }

  const attachResponse = await fetch(
    `https://api.paymongo.com/v1/payment_intents/${paymentIntentId}/attach`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        data: {
          attributes: {
            payment_method: methodJson.data.id,
            client_key: clientKey,
          },
        },
      }),
    }
  );

  const attachJson = (await attachResponse.json()) as {
    data?: {
      attributes?: {
        next_action?: {
          code?: { image_url?: string; expires_at?: number };
        };
      };
    };
    errors?: Array<{ detail?: string }>;
  };

  if (!attachResponse.ok || attachJson.errors) {
    const detail =
      attachJson.errors?.map((e) => e.detail).filter(Boolean).join("; ") ??
      "PayMongo QR Ph attach failed.";
    throw new Error(detail);
  }

  const code = attachJson.data?.attributes?.next_action?.code;
  if (!code?.image_url) {
    throw new Error("PayMongo did not return a QR Ph code.");
  }

  const expiresAt =
    typeof code.expires_at === "number"
      ? code.expires_at * 1000
      : Date.now() + 30 * 60 * 1000;

  return {
    paymentIntentId,
    qrImageUrl: normalizeQrImage(code.image_url),
    expiresAt,
  };
}

export async function createPaymongoCheckoutSession(params: {
  secretKey: string;
  packLabel: string;
  amountCentavos: number;
  purchaseId: string;
  referenceNumber: string;
  uid: string;
  packId: string;
  origin: string;
  billingEmail?: string;
  billingName?: string;
}): Promise<{ checkoutSessionId: string; checkoutUrl: string }> {
  const authString = Buffer.from(`${params.secretKey}:`).toString("base64");

  const response = await fetch("https://api.paymongo.com/v2/checkout_sessions", {
    method: "POST",
    headers: {
      accept: "application/json",
      "Content-Type": "application/json",
      authorization: `Basic ${authString}`,
    },
    body: JSON.stringify({
      data: {
        attributes: {
          billing: {
            name: params.billingName?.trim() || "Bughouse Arena Player",
            email: params.billingEmail?.trim() || "player@bughousearena.com",
          },
          line_items: [
            {
              currency: "PHP",
              amount: params.amountCentavos,
              name: params.packLabel,
              quantity: 1,
            },
          ],
          payment_method_types: ["card", "gcash", "grab_pay", "qrph", "paymaya"],
          reference_number: params.referenceNumber,
          success_url: `${params.origin}/app/shop/success?purchase=${params.purchaseId}`,
          cancel_url: `${params.origin}/app/home?shop=cancelled`,
          metadata: {
            uid: params.uid,
            packId: params.packId,
            purchaseId: params.purchaseId,
          },
        },
      },
    }),
  });

  const json = (await response.json()) as {
    data?: {
      id: string;
      attributes?: { checkout_url?: string };
    };
    errors?: Array<{ detail?: string }>;
  };

  if (!response.ok || json.errors) {
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
