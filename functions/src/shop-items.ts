import type { Firestore } from "firebase-admin/firestore";
import { getShopItem } from "./shop-catalog";

export async function purchaseShopItemForUser(
  db: Firestore,
  uid: string,
  itemId: string
): Promise<{ arenaCoins: number; ownedItems: string[] }> {
  const catalogItem = getShopItem(itemId);
  if (!catalogItem) {
    throw new Error("Unknown shop item.");
  }

  const userRef = db.collection("users").doc(uid);

  return db.runTransaction(async (tx) => {
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists) {
      throw new Error("User not found.");
    }

    const userData = userSnap.data()!;
    const ownedItems = (userData.ownedItems as string[] | undefined) ?? [];

    if (ownedItems.includes(itemId)) {
      throw new Error("You already own this item.");
    }

    const arenaCoins = (userData.arenaCoins as number) ?? 0;
    if (arenaCoins < catalogItem.priceCoins) {
      throw new Error("Not enough Arena Coins.");
    }

    const nextOwned = [...ownedItems, itemId];

    tx.update(userRef, {
      arenaCoins: arenaCoins - catalogItem.priceCoins,
      ownedItems: nextOwned,
    });

    return {
      arenaCoins: arenaCoins - catalogItem.priceCoins,
      ownedItems: nextOwned,
    };
  });
}

export type EquipSlot =
  | "boardTheme"
  | "pieceSet"
  | "victoryFx"
  | "avatarFrame"
  | "emotes";

const FREE_BOARD_THEMES = new Set(["classic", "arena", "forest"]);
const FREE_PIECE_SETS = new Set(["arena"]);

export async function equipShopItemForUser(
  db: Firestore,
  uid: string,
  slot: EquipSlot,
  value: string | string[]
): Promise<void> {
  const userRef = db.collection("users").doc(uid);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    throw new Error("User not found.");
  }

  const userData = userSnap.data()!;
  const ownedItems = (userData.ownedItems as string[] | undefined) ?? [];
  const unlocks = new Set<string>();
  for (const itemId of ownedItems) {
    const item = getShopItem(itemId);
    if (!item) continue;
    for (const unlockId of item.unlockIds) {
      unlocks.add(unlockId);
    }
  }

  if (slot === "boardTheme") {
    const themeId = value as string;
    if (!FREE_BOARD_THEMES.has(themeId) && !unlocks.has(themeId)) {
      throw new Error("Board theme not owned.");
    }
    await userRef.update({ equippedBoardTheme: themeId });
    return;
  }

  if (slot === "pieceSet") {
    const pieceSetId = value as string;
    if (!FREE_PIECE_SETS.has(pieceSetId) && !unlocks.has(pieceSetId)) {
      throw new Error("Piece set not owned.");
    }
    await userRef.update({ equippedPieceSet: pieceSetId });
    return;
  }

  if (slot === "avatarFrame") {
    const frameId = value as string;
    if (frameId !== "none" && !unlocks.has(frameId)) {
      throw new Error("Avatar frame not owned.");
    }
    await userRef.update({
      equippedAvatarFrame: frameId === "none" ? null : frameId,
    });
    return;
  }

  if (slot === "emotes") {
    const emoteIds = value as string[];
    if (emoteIds.length > 4) {
      throw new Error("Maximum 4 equipped emotes.");
    }
    for (const emoteId of emoteIds) {
      if (!unlocks.has(emoteId)) {
        throw new Error(`Emote not owned: ${emoteId}`);
      }
    }
    await userRef.update({ equippedEmoteIds: emoteIds });
    return;
  }

  if (slot === "victoryFx") {
    const fxId = value as string;
    if (fxId !== "default" && !unlocks.has(fxId)) {
      throw new Error("Victory effect not owned.");
    }
    await userRef.update({ equippedVictoryFx: fxId });
    return;
  }

  throw new Error("Invalid equip slot.");
}
