export type ShopCategory = "board" | "piece" | "social" | "profile";

export interface ShopCatalogItem {
  id: string;
  category: ShopCategory;
  label: string;
  description: string;
  priceCoins: number;
  unlockIds: string[];
}

export const SHOP_CATALOG: ShopCatalogItem[] = [
  {
    id: "board_neon",
    category: "board",
    label: "Neon Grid",
    description: "Cyberpunk purple and pink glow squares.",
    priceCoins: 150,
    unlockIds: ["neon"],
  },
  {
    id: "board_obsidian",
    category: "board",
    label: "Obsidian",
    description: "Dark marble board with gold notation.",
    priceCoins: 200,
    unlockIds: ["obsidian"],
  },
  {
    id: "board_sakura",
    category: "board",
    label: "Sakura",
    description: "Soft pink and cream spring palette.",
    priceCoins: 150,
    unlockIds: ["sakura"],
  },
  {
    id: "board_tournament",
    category: "board",
    label: "Tournament",
    description: "High-contrast broadcast-style board.",
    priceCoins: 250,
    unlockIds: ["tournament"],
  },
  {
    id: "piece_glass",
    category: "piece",
    label: "Glass Pieces",
    description: "Translucent neon-tinted piece set.",
    priceCoins: 300,
    unlockIds: ["glass"],
  },
  {
    id: "piece_pixel",
    category: "piece",
    label: "Pixel Pieces",
    description: "Retro chunky piece styling.",
    priceCoins: 200,
    unlockIds: ["pixel"],
  },
  {
    id: "social_team_comms",
    category: "social",
    label: "Team Comms Pack",
    description: "Bughouse quick-chat lines for better coordination.",
    priceCoins: 100,
    unlockIds: ["chat_team_comms"],
  },
  {
    id: "social_emotes_reactions",
    category: "social",
    label: "Reactions Emote Pack",
    description: "Six animated-style emotes for match chat.",
    priceCoins: 350,
    unlockIds: [
      "emote_fire",
      "emote_thumbs",
      "emote_sweat",
      "emote_sleep",
      "emote_knight",
      "emote_gg",
    ],
  },
  {
    id: "profile_frame_neon",
    category: "profile",
    label: "Neon Avatar Frame",
    description: "Glowing cyan border on your profile avatar.",
    priceCoins: 200,
    unlockIds: ["frame_neon"],
  },
  {
    id: "profile_frame_gold",
    category: "profile",
    label: "Gold Avatar Frame",
    description: "Champion gold ring around your avatar.",
    priceCoins: 250,
    unlockIds: ["frame_gold"],
  },
];

export function getShopItem(itemId: string): ShopCatalogItem | undefined {
  return SHOP_CATALOG.find((item) => item.id === itemId);
}

export function getAllUnlockIdsForOwned(ownedItemIds: string[]): Set<string> {
  const unlocks = new Set<string>();
  for (const itemId of ownedItemIds) {
    const item = getShopItem(itemId);
    if (!item) continue;
    for (const unlockId of item.unlockIds) {
      unlocks.add(unlockId);
    }
  }
  return unlocks;
}
