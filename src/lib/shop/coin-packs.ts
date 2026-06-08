export const FIRST_TOPUP_BONUS_RATE = 0.2;

export type CoinPackId =
  | "pack_50"
  | "pack_100"
  | "pack_250"
  | "pack_500"
  | "pack_1200"
  | "pack_2500"
  | "pack_5000";

export interface CoinPack {
  id: CoinPackId;
  coins: number;
  /** Price in Philippine centavos (100 = ₱1.00). */
  amountCentavos: number;
  label: string;
  description: string;
  /** Highlights pack in the top-up grid. */
  featured?: boolean;
}

export const COIN_PACKS: CoinPack[] = [
  {
    id: "pack_50",
    coins: 50,
    amountCentavos: 2900,
    label: "50 Coins",
    description: "Quick top-up",
  },
  {
    id: "pack_100",
    coins: 100,
    amountCentavos: 4900,
    label: "100 Coins",
    description: "Starter bundle",
  },
  {
    id: "pack_250",
    coins: 250,
    amountCentavos: 9900,
    label: "250 Coins",
    description: "Casual player pack",
  },
  {
    id: "pack_500",
    coins: 500,
    amountCentavos: 19900,
    label: "500 Coins",
    description: "Best value",
    featured: true,
  },
  {
    id: "pack_1200",
    coins: 1200,
    amountCentavos: 39900,
    label: "1200 Coins",
    description: "Arena champion",
    featured: true,
  },
  {
    id: "pack_2500",
    coins: 2500,
    amountCentavos: 79900,
    label: "2500 Coins",
    description: "Whale pack",
  },
  {
    id: "pack_5000",
    coins: 5000,
    amountCentavos: 149900,
    label: "5000 Coins",
    description: "Ultimate stash",
  },
];

export function getCoinPack(packId: string): CoinPack | undefined {
  return COIN_PACKS.find((pack) => pack.id === packId);
}

export function formatPhpFromCentavos(centavos: number): string {
  return `₱${(centavos / 100).toLocaleString("en-PH", {
    minimumFractionDigits: centavos % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

export function getFirstTopUpBonusCoins(baseCoins: number): number {
  return Math.floor(baseCoins * FIRST_TOPUP_BONUS_RATE);
}

export function isFirstTopUpBonusEligible(
  usedPackIds: string[] | undefined,
  packId: CoinPackId
): boolean {
  return !(usedPackIds ?? []).includes(packId);
}

export function getTopUpTotalCoins(
  pack: CoinPack,
  usedPackIds: string[] | undefined
): { base: number; bonus: number; total: number } {
  const bonus = isFirstTopUpBonusEligible(usedPackIds, pack.id)
    ? getFirstTopUpBonusCoins(pack.coins)
    : 0;
  return { base: pack.coins, bonus, total: pack.coins + bonus };
}
