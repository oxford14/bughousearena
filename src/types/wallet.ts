import type { Timestamp } from "firebase/firestore";

export type CoinLedgerType =
  | "daily_bonus"
  | "stake_lock"
  | "stake_win"
  | "stake_refund"
  | "tournament_fee"
  | "champion_reward"
  | "referral"
  | "redeem_lock"
  | "redeem_refund"
  | "topup"
  | "shop_purchase"
  | "admin_adjust";

export interface CoinLedgerEntry {
  id: string;
  uid: string;
  amount: number;
  type: CoinLedgerType;
  refId: string;
  balanceAfter: number;
  metadata?: Record<string, unknown>;
  createdAt: Timestamp;
}

export type RedemptionStatus =
  | "pending"
  | "processing"
  | "paid"
  | "rejected"
  | "failed";

export type RedemptionPayoutMethod = "gcash" | "maya" | "bank";

export interface RedemptionRequest {
  id: string;
  uid: string;
  bundleId: string;
  coins: number;
  phpAmount: number;
  /** Destination method — defaults to gcash for older requests. */
  payoutMethod?: RedemptionPayoutMethod;
  /** Account holder name (any method). */
  accountName?: string;
  /** Mobile or bank account number (digits). */
  accountNumber?: string;
  /** Required when payoutMethod is bank. */
  bankName?: string | null;
  /** @deprecated Prefer accountNumber — kept for older requests. */
  gcashNumber: string;
  /** @deprecated Prefer accountName — kept for older requests. */
  gcashName: string;
  status: RedemptionStatus;
  adminNote?: string | null;
  paymongoTransferId?: string | null;
  paymongoBatchId?: string | null;
  createdAt: Timestamp;
  processedAt?: Timestamp | null;
}

export interface StakeLock {
  uid: string;
  matchId?: string | null;
  stakeAmount: number;
  queueEntryId?: string | null;
  status: "locked" | "settled" | "refunded";
  createdAt: Timestamp;
}

export type ReferralStatus = "pending" | "active" | "completed";

export interface ReferralRecord {
  referredUid: string;
  referrerUid: string;
  referralCode: string;
  status: ReferralStatus;
  firstMatchRewarded: boolean;
  topUpRewarded: boolean;
  createdAt: Timestamp;
}

export type TournamentStatus = "registration" | "active" | "completed" | "cancelled";

export interface TournamentBracketMatch {
  id: string;
  round: number;
  matchIndex: number;
  team1Id: string | null;
  team2Id: string | null;
  matchId: string | null;
  winnerTeamId: string | null;
}

export interface TournamentDocument {
  id: string;
  name: string;
  description?: string;
  registrationFeeCoins: number;
  maxTeams: number;
  registeredTeamCount: number;
  championRewardCoins: number;
  status: TournamentStatus;
  startsAt: Timestamp;
  createdAt: Timestamp;
  bracket?: TournamentBracketMatch[];
  championTeamId?: string | null;
  runnerUpTeamId?: string | null;
}

export interface TournamentTeam {
  id: string;
  tournamentId: string;
  teamName: string;
  player1Uid: string;
  player2Uid: string;
  player1DisplayName: string;
  player2DisplayName: string;
  registeredAt: Timestamp;
}
