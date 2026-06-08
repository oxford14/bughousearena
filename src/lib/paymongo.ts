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
