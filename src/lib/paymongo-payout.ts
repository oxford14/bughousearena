const PAYMONGO_WALLET_BIC = "PAEYPHM2XXX";

interface ReceivingInstitution {
  id?: string;
  bic?: string;
  name?: string;
  attributes?: { bic?: string; name?: string };
}

function authHeader(secretKey: string): string {
  return `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`;
}

/**
 * Resolves the InstaPay BIC for GCash (G-Xchange) from PayMongo's receiving
 * institutions list. Cached per process.
 */
let cachedGcashBic: string | null = null;

export async function getGcashReceivingBic(secretKey: string): Promise<string> {
  if (cachedGcashBic) return cachedGcashBic;

  const response = await fetch(
    "https://api.paymongo.com/v2/transfers/receiving_institutions?provider=instapay",
    {
      headers: {
        accept: "application/json",
        authorization: authHeader(secretKey),
      },
    }
  );

  const json = (await response.json()) as {
    data?: ReceivingInstitution[];
    errors?: Array<{ detail?: string }>;
  };

  if (!response.ok || json.errors || !json.data) {
    const detail =
      json.errors?.map((e) => e.detail).filter(Boolean).join("; ") ??
      "Failed to load PayMongo receiving institutions.";
    throw new Error(detail);
  }

  const match = json.data.find((inst) => {
    const name = (inst.attributes?.name ?? inst.name ?? "").toLowerCase();
    return name.includes("gcash") || name.includes("g-xchange") || name.includes("g xchange");
  });

  const bic =
    match?.attributes?.bic ?? match?.bic ?? (match?.id as string | undefined);
  if (!bic) {
    throw new Error("Could not resolve a GCash BIC from PayMongo.");
  }

  cachedGcashBic = bic;
  return bic;
}

export interface CreateTransferResult {
  batchId: string;
  transferId: string;
  status: string;
}

/**
 * Sends a single GCash payout via PayMongo's batch transfers (InstaPay rail).
 * Requires an activated + funded PayMongo Wallet with disbursements enabled.
 */
export async function createGcashTransfer(params: {
  secretKey: string;
  amountCentavos: number;
  gcashNumber: string;
  gcashName: string;
  gcashBic: string;
  sourceNumber: string;
  sourceName: string;
  description: string;
  callbackUrl?: string;
  metadata?: Record<string, unknown>;
}): Promise<CreateTransferResult> {
  const response = await fetch("https://api.paymongo.com/v2/batch_transfers", {
    method: "POST",
    headers: {
      accept: "application/json",
      "Content-Type": "application/json",
      authorization: authHeader(params.secretKey),
    },
    body: JSON.stringify({
      transfers: [
        {
          provider: "instapay",
          amount: params.amountCentavos,
          currency: "PHP",
          description: params.description,
          source_account: {
            number: params.sourceNumber,
            name: params.sourceName,
            bic: PAYMONGO_WALLET_BIC,
          },
          destination_account: {
            number: params.gcashNumber,
            name: params.gcashName,
            bic: params.gcashBic,
          },
          ...(params.callbackUrl ? { callback_url: params.callbackUrl } : {}),
          ...(params.metadata ? { metadata: params.metadata } : {}),
        },
      ],
    }),
  });

  const json = (await response.json()) as {
    data?: {
      id?: string;
      attributes?: {
        transfers?: Array<{ id?: string; attributes?: { status?: string } }>;
      };
    };
    errors?: Array<{ detail?: string }>;
  };

  if (!response.ok || json.errors) {
    const detail =
      json.errors?.map((e) => e.detail).filter(Boolean).join("; ") ??
      "PayMongo transfer failed.";
    throw new Error(detail);
  }

  const batchId = json.data?.id ?? "";
  const transfer = json.data?.attributes?.transfers?.[0];
  const transferId = transfer?.id ?? "";
  const status = transfer?.attributes?.status ?? "pending";

  if (!transferId) {
    throw new Error("PayMongo did not return a transfer id.");
  }

  return { batchId, transferId, status };
}
