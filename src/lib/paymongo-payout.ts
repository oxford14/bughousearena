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

let cachedInstitutions: ReceivingInstitution[] | null = null;

async function listInstapayInstitutions(
  secretKey: string
): Promise<ReceivingInstitution[]> {
  if (cachedInstitutions) return cachedInstitutions;

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

  cachedInstitutions = json.data;
  return cachedInstitutions;
}

function institutionName(inst: ReceivingInstitution): string {
  return (inst.attributes?.name ?? inst.name ?? "").toLowerCase();
}

function institutionBic(inst: ReceivingInstitution): string | null {
  return (
    inst.attributes?.bic ??
    inst.bic ??
    (typeof inst.id === "string" ? inst.id : null)
  );
}

/**
 * Resolves an InstaPay BIC for GCash, Maya, or a bank by matching institution names.
 */
export async function getInstapayReceivingBic(
  secretKey: string,
  institutionHint: string
): Promise<string> {
  const institutions = await listInstapayInstitutions(secretKey);
  const needle = institutionHint.toLowerCase().trim();
  const tokens = needle
    .split(/[\s,/]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 2);

  const match =
    institutions.find((inst) => {
      const name = institutionName(inst);
      return name === needle || name.includes(needle) || needle.includes(name);
    }) ??
    institutions.find((inst) => {
      const name = institutionName(inst);
      return tokens.some(
        (token) =>
          name.includes(token) ||
          (token === "g-xchange" && name.includes("gcash")) ||
          (token === "gcash" && name.includes("g-xchange")) ||
          (token === "maya" && name.includes("maya"))
      );
    });

  const bic = match ? institutionBic(match) : null;
  if (!bic) {
    throw new Error(
      `Could not resolve an InstaPay institution for "${institutionHint}".`
    );
  }
  return bic;
}

/** @deprecated Prefer getInstapayReceivingBic */
export async function getGcashReceivingBic(secretKey: string): Promise<string> {
  return getInstapayReceivingBic(secretKey, "G-Xchange");
}

export interface CreateTransferResult {
  batchId: string;
  transferId: string;
  status: string;
}

/**
 * Sends a PHP payout via PayMongo batch transfers (InstaPay rail).
 */
export async function createInstapayTransfer(params: {
  secretKey: string;
  amountCentavos: number;
  accountNumber: string;
  accountName: string;
  destinationBic: string;
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
            number: params.accountNumber,
            name: params.accountName,
            bic: params.destinationBic,
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

/** @deprecated Prefer createInstapayTransfer */
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
  return createInstapayTransfer({
    secretKey: params.secretKey,
    amountCentavos: params.amountCentavos,
    accountNumber: params.gcashNumber,
    accountName: params.gcashName,
    destinationBic: params.gcashBic,
    sourceNumber: params.sourceNumber,
    sourceName: params.sourceName,
    description: params.description,
    callbackUrl: params.callbackUrl,
    metadata: params.metadata,
  });
}
