import type { Timestamp } from "firebase/firestore";

export type MatchMode = "casual" | "ranked" | "private" | "stake";
/** Chess variant. Legacy matches without this field are treated as bughouse. */
export type ChessGameType = "bughouse" | "standard" | "crazyhouse" | "atomic";
export type MatchStatus = "setup" | "active" | "completed" | "abandoned";
export type MatchEndReason =
  | "checkmate"
  | "explosion"
  | "time_forfeit"
  | "resignation";
export type PlayerColor = "w" | "b";
export type HouseRole = "founder" | "steward" | "member";
export type FriendRequestStatus = "pending" | "accepted" | "declined";
export type OnlineStatus = "online" | "away" | "offline";

export interface UserProfile {
  uid: string;
  displayName: string;
  photoURL: string | null;
  email: string | null;
  /** Bughouse rating (primary / legacy). */
  rating: number;
  rankedWins: number;
  rankedLosses: number;
  /** Standard chess rating (default 1200 when missing). */
  standardRating?: number;
  standardRankedWins?: number;
  standardRankedLosses?: number;
  /** Crazyhouse rating (default 1200 when missing). */
  crazyhouseRating?: number;
  crazyhouseRankedWins?: number;
  crazyhouseRankedLosses?: number;
  /** Atomic chess rating (default 1200 when missing). */
  atomicRating?: number;
  atomicRankedWins?: number;
  atomicRankedLosses?: number;
  arenaCoins: number;
  /** Lifetime real-money top-up total in PHP centavos (VIP basis). */
  totalTopUpCentavos?: number;
  /** Pack IDs that already received the one-time first top-up bonus. */
  firstTopUpBonusUsedPackIds?: string[];
  ownedItems?: string[];
  equippedBoardTheme?: string | null;
  equippedPieceSet?: string | null;
  equippedVictoryFx?: string | null;
  equippedEmoteIds?: string[];
  equippedAvatarFrame?: string | null;
  houseId: string | null;
  onlineStatus: OnlineStatus;
  lastOnline: Timestamp | null;
  createdAt: Timestamp;
  /** Prevents double-applying ranked ELO for the same match. */
  lastRatedMatchId?: string | null;
  lastRatingChange?: number | null;
  /** Daily sign-in streak (1–7). */
  dailyStreak?: number;
  /** Manila date key (YYYY-MM-DD) of last daily claim. */
  lastDailyClaimDateKey?: string;
  /** Unique referral code for this user. */
  referralCode?: string;
  /** UID of the player who referred this user. */
  referredByUid?: string | null;
  /** Total completed matches (all modes). */
  completedMatches?: number;
  /** Set when an account is banned/suspended by a super admin. */
  banned?: boolean;
}

export type CoinPurchaseStatus = "pending" | "paid" | "failed" | "expired";

export interface CoinPurchase {
  id: string;
  uid: string;
  packId: string;
  /** Base pack coins (before bonus). */
  coins: number;
  bonusCoins?: number;
  coinsCredited?: number;
  amountCentavos: number;
  status: CoinPurchaseStatus;
  paymongoCheckoutSessionId?: string | null;
  referenceNumber: string;
  createdAt: Timestamp;
  paidAt?: Timestamp | null;
}

export interface FriendEntry {
  friendId: string;
  displayName: string;
  photoURL: string | null;
  since: Timestamp;
  onlineStatus: OnlineStatus;
}

export interface FriendRequest {
  id: string;
  fromUid: string;
  toUid: string;
  fromDisplayName: string;
  status: FriendRequestStatus;
  createdAt: Timestamp;
}

export interface DirectMessage {
  id: string;
  fromUid: string;
  text: string;
  read: boolean;
  createdAt: Timestamp;
}

export interface MatchPlayer {
  uid: string;
  displayName: string;
  photoURL: string | null;
  boardId: string;
  team: 1 | 2;
  rating: number;
  isBot?: boolean;
  botSkill?: string;
  rankTier?: string;
  playerColor?: PlayerColor;
}

export interface MatchDocument {
  id: string;
  mode: MatchMode;
  /** Chess variant. Missing → bughouse. */
  gameType?: ChessGameType;
  status: MatchStatus;
  players: MatchPlayer[];
  teamClocks: { team1: number; team2: number };
  winnerTeam: 1 | 2 | null;
  endReason?: MatchEndReason | null;
  resignedByUid?: string | null;
  createdAt: Timestamp;
  startedAt: Timestamp | null;
  completedAt: Timestamp | null;
  setupEndsAt?: Timestamp | null;
  colorChoices?: Record<string, PlayerColor>;
  privateRoomCode?: string;
  playerUids?: string[];
  botUids?: string[];
  hasBots?: boolean;
  /** Per-team clock budget in seconds (e.g. 60 blitz, 300 standard). */
  timeControl?: number;
  /** Epoch ms when any board first started counting (first move anywhere). */
  clocksStartedAtMs?: number | null;
  /** Stake amount per player (stake mode only). */
  stakePerPlayer?: number;
  /** Linked tournament (tournament matches only). */
  tournamentId?: string | null;
  /** Tournament bracket slot id. */
  tournamentBracketMatchId?: string | null;
  /** Tournament team id seated as in-game team 1. */
  tournamentTeam1Id?: string | null;
  /** Tournament team id seated as in-game team 2. */
  tournamentTeam2Id?: string | null;
}

export interface BoardDocument {
  id: string;
  fen: string;
  /** Bughouse: partner reserve. Crazyhouse: own pocket. Standard: unused. */
  captured: string[];
  turn: "w" | "b";
  lastMove: string | null;
  playerUid: string;
  /** Empty for 1v1 single-board matches. */
  partnerBoardId: string;
  team: 1 | 2;
  playerColor?: PlayerColor;
  promotedSquares?: string[];
  boardStatus?: "active" | "stalemate" | "checkmate";
  whiteClock?: number;
  blackClock?: number;
  clockRunning?: PlayerColor | null;
  clockUpdatedAtMs?: number;
  isCheck: boolean;
  isGameOver: boolean;
}

export interface MatchSetupChatMessage {
  id: string;
  team: 1 | 2;
  uid: string;
  displayName: string;
  text: string;
  vipLevel?: number;
  createdAt: Timestamp;
}

export type ChatScope = "team" | "all";

export interface MatchChatMessage {
  id: string;
  team: 1 | 2;
  /** "team" reaches only the sender's team; "all" reaches both teams. */
  scope: ChatScope;
  /** Teams allowed to read this message (query filter). */
  audience: (1 | 2)[];
  uid: string;
  displayName: string;
  text: string;
  vipLevel?: number;
  templateId?: string;
  emoteId?: string;
  createdAt: Timestamp;
}

export interface MoveDocument {
  id: string;
  boardId: string;
  playerId: string;
  move: string;
  validated: boolean;
  createdAt: Timestamp;
}

export interface MatchmakingEntry {
  id: string;
  uid: string;
  displayName: string;
  mode: MatchMode;
  /** Chess variant. Missing → bughouse. */
  gameType?: ChessGameType;
  rating: number;
  timestamp: Timestamp;
  partyId?: string | null;
  memberUids: string[];
  members: MatchmakingMember[];
  /** Casual only — clock budget in seconds (60 blitz, 300 standard). */
  timeControl?: number;
  /** Stake tier in coins (stake mode only). */
  stakePerPlayer?: number;
}

export interface MatchmakingMember {
  uid: string;
  displayName: string;
  photoURL: string | null;
  rating: number;
  isBot?: boolean;
  botSkill?: string;
  rankTier?: string;
}

export interface PartyMember {
  uid: string;
  displayName: string;
  photoURL: string | null;
  rating: number;
}

export interface PartyDocument {
  id: string;
  leaderUid: string;
  code: string;
  members: PartyMember[];
  memberUids: string[];
  /** Members who opted in to matchmaking with the party leader. */
  readyUids?: string[];
  createdAt: Timestamp;
}

export interface PartyInvite {
  id: string;
  partyId: string;
  /** @deprecated Invites join by partyId */
  partyCode?: string;
  fromUid: string;
  fromDisplayName: string;
  toUid: string;
  status: "pending" | "accepted" | "declined";
  createdAt: Timestamp;
}

export interface PrivateRoom {
  code: string;
  hostId: string;
  hostDisplayName: string;
  settings: {
    mode: MatchMode;
    timeControl: number;
    gameType?: ChessGameType;
  };
  players: MatchPlayer[];
  status: "waiting" | "starting" | "started";
  matchId?: string | null;
  createdAt: Timestamp;
}

export interface HouseDocument {
  id: string;
  name: string;
  description: string;
  bannerUrl: string;
  crestUrl: string;
  founderId: string;
  houseRating: number;
  memberCount: number;
  /** When true, players can join without admin approval. */
  autoAccept?: boolean;
  createdAt: Timestamp;
}

export interface HouseMember {
  uid: string;
  displayName: string;
  role: HouseRole;
  joinedAt: Timestamp;
}

export interface HouseChatMessage {
  id: string;
  uid: string;
  displayName: string;
  text: string;
  createdAt: Timestamp;
}

export interface WorldChatMessage {
  id: string;
  uid: string;
  displayName: string;
  photoURL?: string | null;
  text: string;
  createdAt: Timestamp;
}

export interface LeaderboardEntry {
  id: string;
  displayName: string;
  photoURL: string | null;
  rating: number;
  wins: number;
  rank: number;
}

export interface MatchHistoryEntry {
  /** Firestore document id (unique per history row). */
  id: string;
  matchId: string;
  mode: MatchMode;
  gameType?: ChessGameType;
  result: "win" | "loss" | "draw";
  opponents: string[];
  duration: number;
  ratingChange: number;
  completedAt: Timestamp;
}

export interface VoiceSignal {
  id: string;
  uid: string;
  /** Target teammate uid this signal is addressed to. */
  to: string;
  type: "offer" | "answer" | "ice";
  sdp?: string;
  candidate?: RTCIceCandidateInit;
  createdAt: Timestamp;
}
