import { getFirebaseAuth } from "@/lib/firebase/config";

export interface CreateCheckoutResult {
  checkoutUrl: string;
  purchaseId: string;
  sessionId?: string;
}

export interface PurchaseStatusResult {
  status: string;
  coins?: number;
  baseCoins?: number;
  bonusCoins?: number;
  packId?: string;
  message?: string;
}

async function getAuthHeaders(): Promise<HeadersInit> {
  const user = getFirebaseAuth().currentUser;
  if (!user) {
    throw new Error("Sign in to top up coins.");
  }
  const idToken = await user.getIdToken();
  return {
    Authorization: `Bearer ${idToken}`,
    "Content-Type": "application/json",
  };
}

export async function createCoinCheckout(
  packId: string
): Promise<CreateCheckoutResult> {
  const headers = await getAuthHeaders();
  const response = await fetch("/api/paymongo/create-checkout", {
    method: "POST",
    headers,
    body: JSON.stringify({ packId }),
  });

  const data = (await response.json()) as CreateCheckoutResult & {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(data.error ?? "Could not start checkout.");
  }

  return data;
}

export async function confirmCoinPurchase(
  purchaseId: string
): Promise<PurchaseStatusResult> {
  const headers = await getAuthHeaders();
  const response = await fetch("/api/paymongo/confirm", {
    method: "POST",
    headers,
    body: JSON.stringify({ purchaseId }),
  });

  const data = (await response.json()) as PurchaseStatusResult & {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(data.error ?? "Could not confirm purchase.");
  }

  return data;
}

/** @deprecated Use confirmCoinPurchase — kept for compatibility */
export async function getCoinPurchaseStatus(
  purchaseId: string
): Promise<PurchaseStatusResult & { coins: number; packId: string }> {
  const result = await confirmCoinPurchase(purchaseId);
  return {
    ...result,
    coins: result.coins ?? 0,
    packId: result.packId ?? "",
  };
}
