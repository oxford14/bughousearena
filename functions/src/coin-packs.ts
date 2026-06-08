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
  amountCentavos: number;
  label: string;
}

export const COIN_PACKS: CoinPack[] = [
  { id: "pack_50", coins: 50, amountCentavos: 2900, label: "50 Arena Coins" },
  { id: "pack_100", coins: 100, amountCentavos: 4900, label: "100 Arena Coins" },
  { id: "pack_250", coins: 250, amountCentavos: 9900, label: "250 Arena Coins" },
  { id: "pack_500", coins: 500, amountCentavos: 19900, label: "500 Arena Coins" },
  { id: "pack_1200", coins: 1200, amountCentavos: 39900, label: "1200 Arena Coins" },
  { id: "pack_2500", coins: 2500, amountCentavos: 79900, label: "2500 Arena Coins" },
  { id: "pack_5000", coins: 5000, amountCentavos: 149900, label: "5000 Arena Coins" },
];

export function getCoinPack(packId: string): CoinPack | undefined {
  return COIN_PACKS.find((pack) => pack.id === packId);
}

export function getFirstTopUpBonusCoins(baseCoins: number): number {
  return Math.floor(baseCoins * FIRST_TOPUP_BONUS_RATE);
}
