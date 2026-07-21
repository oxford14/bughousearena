export interface RedeemBundle {
  id: string;
  label: string;
  coins: number;
  phpAmount: number;
  description: string;
}

export const REDEEM_BUNDLES: RedeemBundle[] = [
  {
    id: "redeem_starter",
    label: "Starter",
    coins: 800,
    phpAmount: 100,
    description: "800 coins → ₱100 GCash",
  },
  {
    id: "redeem_bronze",
    label: "Bronze",
    coins: 2000,
    phpAmount: 280,
    description: "2,000 coins → ₱280 GCash",
  },
  {
    id: "redeem_silver",
    label: "Silver",
    coins: 4000,
    phpAmount: 600,
    description: "4,000 coins → ₱600 GCash",
  },
  {
    id: "redeem_gold",
    label: "Gold",
    coins: 8000,
    phpAmount: 1300,
    description: "8,000 coins → ₱1,300 GCash",
  },
  {
    id: "redeem_diamond",
    label: "Diamond",
    coins: 20000,
    phpAmount: 3500,
    description: "20,000 coins → ₱3,500 GCash",
  },
];

export const REDEEM_MIN_RANKED_MATCHES = 20;
export const REDEEM_MIN_ACCOUNT_AGE_DAYS = 7;

export function getRedeemBundle(bundleId: string): RedeemBundle | undefined {
  return REDEEM_BUNDLES.find((b) => b.id === bundleId);
}
