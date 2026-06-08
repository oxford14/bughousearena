import type { UserProfile } from "@/types/firestore";
import { getAllUnlockIdsForOwned, getShopItem } from "@/lib/shop/catalog";
import { FREE_BOARD_THEME_IDS, type BoardThemeId } from "@/lib/game/board-themes";
import { FREE_PIECE_SET_ID, type PieceSetId } from "@/lib/game/piece-sets";

export function getOwnedItemIds(profile: UserProfile | null | undefined): string[] {
  return profile?.ownedItems ?? [];
}

export function ownsShopItem(
  profile: UserProfile | null | undefined,
  itemId: string
): boolean {
  return getOwnedItemIds(profile).includes(itemId);
}

export function getUnlockIds(profile: UserProfile | null | undefined): Set<string> {
  return getAllUnlockIdsForOwned(getOwnedItemIds(profile));
}

export function hasUnlock(
  profile: UserProfile | null | undefined,
  unlockId: string
): boolean {
  return getUnlockIds(profile).has(unlockId);
}

export function isBoardThemeUnlocked(
  profile: UserProfile | null | undefined,
  themeId: BoardThemeId
): boolean {
  if (FREE_BOARD_THEME_IDS.includes(themeId)) return true;
  return hasUnlock(profile, themeId);
}

export function isPieceSetUnlocked(
  profile: UserProfile | null | undefined,
  pieceSetId: PieceSetId
): boolean {
  if (pieceSetId === FREE_PIECE_SET_ID) return true;
  return hasUnlock(profile, pieceSetId);
}

export function getShopItemPrice(itemId: string): number {
  return getShopItem(itemId)?.priceCoins ?? 0;
}
