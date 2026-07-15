export const STAKE_TIERS = [25, 50, 100, 250] as const;
export type StakeTier = (typeof STAKE_TIERS)[number];

export const STAKE_ARENA_FEE_RATE = 0.1;

export function getStakeWinPayout(stakePerPlayer: number): number {
  return Math.floor(stakePerPlayer * 2 * (1 - STAKE_ARENA_FEE_RATE));
}

export function isValidStakeTier(amount: number): amount is StakeTier {
  return (STAKE_TIERS as readonly number[]).includes(amount);
}
