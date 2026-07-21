/**
 * Chess game variants on Bughouse Arena.
 * Bughouse is the default / featured identity; other modes are 1v1.
 */

import type { MatchMode, UserProfile } from "@/types/firestore";

export type ChessGameType = "bughouse" | "standard" | "crazyhouse" | "atomic";

export const DEFAULT_GAME_TYPE: ChessGameType = "bughouse";
export const DEFAULT_RATING = 1200;

export const GAME_TYPE_STORAGE_KEY = "bha.gameType";

export interface GameTypeMeta {
  id: ChessGameType;
  label: string;
  shortLabel: string;
  featured: boolean;
  players: 2 | 4;
  /** Match modes offered in the lobby for this game type. */
  matchModes: MatchMode[];
  description: string;
}

export const GAME_TYPES: GameTypeMeta[] = [
  {
    id: "bughouse",
    label: "Bughouse (Featured)",
    shortLabel: "Bughouse",
    featured: true,
    players: 4,
    matchModes: ["casual", "ranked", "stake", "private"],
    description: "Team chess with piece passing. 2v2 on twin boards.",
  },
  {
    id: "standard",
    label: "Standard Chess",
    shortLabel: "Standard",
    featured: false,
    players: 2,
    matchModes: ["casual", "stake", "private"],
    description: "Traditional FIDE chess. 1v1, no piece drops.",
  },
  {
    id: "crazyhouse",
    label: "Crazyhouse",
    shortLabel: "Crazyhouse",
    featured: false,
    players: 2,
    matchModes: ["casual", "stake", "private"],
    description:
      "1v1 with drops: pieces you capture go to your pocket and can be placed back on empty squares.",
  },
  {
    id: "atomic",
    label: "Atomic Chess",
    shortLabel: "Atomic",
    featured: false,
    players: 2,
    matchModes: ["casual", "stake", "private"],
    description:
      "1v1 explosive chess: every capture nukes the surrounding pieces. Explode the enemy king to win.",
  },
];

export const CRAZYHOUSE_HOWTO = {
  title: "How Crazyhouse works",
  points: [
    "Two players on one board — no partner.",
    "When you capture a piece, it goes into your pocket (your color).",
    "On your turn you may drop a pocket piece onto any empty square (pawns not on 1st/8th rank).",
    "Checkmate, resignation, or time wins — same as standard chess.",
  ],
};

export const ATOMIC_HOWTO = {
  title: "How Atomic Chess works",
  points: [
    "Two players on one board — captures cause explosions.",
    "A capture removes the capturer, the captured piece, and all adjacent non-pawn pieces.",
    "Pawns next to the blast survive (unless they were captured or capturing).",
    "Kings cannot capture. Exploding the enemy king wins; you may not explode your own.",
    "When kings are adjacent, checks do not apply.",
  ],
};

export function isChessGameType(value: unknown): value is ChessGameType {
  return (
    value === "bughouse" ||
    value === "standard" ||
    value === "crazyhouse" ||
    value === "atomic"
  );
}

export function normalizeGameType(value: unknown): ChessGameType {
  return isChessGameType(value) ? value : DEFAULT_GAME_TYPE;
}

export function getGameTypeMeta(gameType: ChessGameType): GameTypeMeta {
  return GAME_TYPES.find((g) => g.id === gameType) ?? GAME_TYPES[0]!;
}

export function isSoloGameType(gameType: ChessGameType): boolean {
  return gameType !== "bughouse";
}

/** Solo contexts where a party cannot queue (1v1 game types). Bughouse stake allows parties. */
export function isSoloMatchContext(
  gameType: ChessGameType,
  _mode?: MatchMode
): boolean {
  return isSoloGameType(gameType);
}

export function playersNeeded(gameType: ChessGameType): 2 | 4 {
  return getGameTypeMeta(gameType).players;
}

export function allowedMatchModes(gameType: ChessGameType): MatchMode[] {
  return getGameTypeMeta(gameType).matchModes;
}

export function getRatingForGameType(
  profile: Pick<
    UserProfile,
    | "rating"
    | "standardRating"
    | "crazyhouseRating"
    | "atomicRating"
  > | null | undefined,
  gameType: ChessGameType
): number {
  if (!profile) return DEFAULT_RATING;
  if (gameType === "standard") {
    return profile.standardRating ?? DEFAULT_RATING;
  }
  if (gameType === "crazyhouse") {
    return profile.crazyhouseRating ?? DEFAULT_RATING;
  }
  if (gameType === "atomic") {
    return profile.atomicRating ?? DEFAULT_RATING;
  }
  return profile.rating ?? DEFAULT_RATING;
}

export function parseGameTypeParam(raw: string | null | undefined): ChessGameType | null {
  if (!raw) return null;
  return isChessGameType(raw) ? raw : null;
}
