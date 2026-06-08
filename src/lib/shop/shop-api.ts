import { getFirebaseAuth } from "@/lib/firebase/config";

export interface PurchaseShopItemResult {
  arenaCoins: number;
  ownedItems: string[];
}

export type EquipSlot =
  | "boardTheme"
  | "pieceSet"
  | "victoryFx"
  | "avatarFrame"
  | "emotes";

async function getAuthHeaders(): Promise<HeadersInit> {
  const user = getFirebaseAuth().currentUser;
  if (!user) {
    throw new Error("Sign in to use the shop.");
  }
  const idToken = await user.getIdToken();
  return {
    Authorization: `Bearer ${idToken}`,
    "Content-Type": "application/json",
  };
}

async function parseApiError(response: Response): Promise<string> {
  const data = (await response.json().catch(() => ({}))) as { error?: string };
  return data.error ?? "Request failed.";
}

export async function purchaseShopItem(
  itemId: string
): Promise<PurchaseShopItemResult> {
  const headers = await getAuthHeaders();
  const response = await fetch("/api/shop/purchase", {
    method: "POST",
    headers,
    body: JSON.stringify({ itemId }),
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  return (await response.json()) as PurchaseShopItemResult;
}

export async function equipShopItem(
  slot: EquipSlot,
  value: string | string[]
): Promise<void> {
  const headers = await getAuthHeaders();
  const response = await fetch("/api/shop/equip", {
    method: "POST",
    headers,
    body: JSON.stringify({ slot, value }),
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
}
