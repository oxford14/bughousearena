import type { Timestamp } from "firebase/firestore";

export type CoinLedgerType =
  | "daily_bonus"
  | "stake_lock"
  | "stake_win"
  | "stake_refund"
  | "tournament_fee"
  | "tournament_refund"
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

export type TournamentVisibility = "public" | "private";

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
  hostUid: string;
  hostDisplayName: string;
  visibility: TournamentVisibility;
  /** Short uppercase code for search / private join. */
  roomCode: string;
  /** SHA-256 hash of PIN + roomCode; only set for private tournaments. */
  pinHash?: string | null;
  registrationFeeCoins: number;
  maxTeams: number;
  /** Max individual players in the lobby (16 = 8 pairs). */
  maxPlayers: number;
  /** Players currently in the room (lobby). */
  playerCount: number;
  /** Join order for host succession. */
  memberUids: string[];
  /** Teams formed after start (0 while in lobby). */
  registeredTeamCount: number;
  /** Gross entry fees collected (set when tournament starts). */
  prizePoolCoins: number;
  /** Display payout = floor(prizePoolCoins * 0.8). */
  championRewardCoins: number;
  status: TournamentStatus;
  /** 16 player seats in the lobby (uid or null). */
  slots?: (string | null)[];
  currentRound: number;
  createdAt: Timestamp;
  /** @deprecated Kept optional for legacy docs. */
  startsAt?: Timestamp | null;
  bracket?: TournamentBracketMatch[];
  championTeamId?: string | null;
  runnerUpTeamId?: string | null;
}

/** Individual player in the tournament lobby room. */
export interface TournamentMember {
  uid: string;
  displayName: string;
  photoURL: string | null;
  joinOrder: number;
  /** Index into tournament.slots (0–15). */
  slotIndex: number;
  joinedAt: Timestamp;
}

export interface TournamentTeam {
  id: string;
  tournamentId: string;
  teamName: string;
  player1Uid: string;
  player2Uid: string;
  player1DisplayName: string;
  player2DisplayName: string;
  slotIndex?: number;
  registeredAt: Timestamp;
}
