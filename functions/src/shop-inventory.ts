import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getDb } from "./db";
import {
  equipShopItemForUser,
  purchaseShopItemForUser,
  type EquipSlot,
} from "./shop-items";

export const purchaseShopItem = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be signed in.");
  }

  const { itemId } = request.data as { itemId?: string };
  if (!itemId || typeof itemId !== "string") {
    throw new HttpsError("invalid-argument", "itemId is required.");
  }

  try {
    const result = await purchaseShopItemForUser(
      getDb(),
      request.auth.uid,
      itemId
    );
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Purchase failed.";
    if (message.includes("Not enough")) {
      throw new HttpsError("failed-precondition", message);
    }
    if (message.includes("already own")) {
      throw new HttpsError("already-exists", message);
    }
    throw new HttpsError("invalid-argument", message);
  }
});

export const equipShopItem = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be signed in.");
  }

  const { slot, value } = request.data as {
    slot?: EquipSlot;
    value?: string | string[];
  };

  const validSlots: EquipSlot[] = [
    "boardTheme",
    "pieceSet",
    "victoryFx",
    "avatarFrame",
    "emotes",
  ];

  if (!slot || !validSlots.includes(slot)) {
    throw new HttpsError("invalid-argument", "Invalid equip slot.");
  }
  if (value === undefined || value === null) {
    throw new HttpsError("invalid-argument", "value is required.");
  }

  try {
    await equipShopItemForUser(getDb(), request.auth.uid, slot, value);
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Equip failed.";
    throw new HttpsError("permission-denied", message);
  }
});
