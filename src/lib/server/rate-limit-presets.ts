const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

export type RateLimitTier =
  | "globalIp"
  | "topupCreate"
  | "topupConfirm"
  | "redeemRequest"
  | "redeemEligibility"
  | "walletMutation"
  | "admin"
  | "webhook"
  | "botMove";

export type RateLimitPreset = {
  windowMs: number;
  /** Per authenticated uid (optional). */
  uidLimit?: number;
  /** Per client IP (optional). */
  ipLimit?: number;
};

export const RATE_LIMIT_TIERS: Record<RateLimitTier, RateLimitPreset> = {
  globalIp: {
    windowMs: MINUTE_MS,
    ipLimit: 120,
  },
  topupCreate: {
    windowMs: MINUTE_MS,
    uidLimit: 5,
    ipLimit: 10,
  },
  topupConfirm: {
    windowMs: MINUTE_MS,
    uidLimit: 20,
  },
  redeemRequest: {
    windowMs: HOUR_MS,
    uidLimit: 3,
    ipLimit: 5,
  },
  redeemEligibility: {
    windowMs: MINUTE_MS,
    uidLimit: 30,
  },
  walletMutation: {
    windowMs: MINUTE_MS,
    uidLimit: 20,
  },
  admin: {
    windowMs: MINUTE_MS,
    uidLimit: 30,
  },
  webhook: {
    windowMs: MINUTE_MS,
    ipLimit: 120,
  },
  botMove: {
    windowMs: MINUTE_MS,
    uidLimit: 60,
  },
};
