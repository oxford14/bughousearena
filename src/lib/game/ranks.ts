export type RankTier = "pawn" | "knight" | "bishop" | "rook" | "queen" | "king";

const LEGACY_TIER_MAP: Record<string, RankTier> = {
  bronze: "pawn",
  silver: "knight",
  gold: "bishop",
  platinum: "rook",
  diamond: "queen",
  legend: "king",
};

export function getRankTier(rating: number): RankTier {
  if (rating >= 2200) return "king";
  if (rating >= 1900) return "queen";
  if (rating >= 1600) return "rook";
  if (rating >= 1400) return "bishop";
  if (rating >= 1200) return "knight";
  return "pawn";
}

export function normalizeRankTier(tier: string): RankTier {
  if (tier in LEGACY_TIER_MAP) return LEGACY_TIER_MAP[tier]!;
  if (
    tier === "pawn" ||
    tier === "knight" ||
    tier === "bishop" ||
    tier === "rook" ||
    tier === "queen" ||
    tier === "king"
  ) {
    return tier;
  }
  return "pawn";
}

export function getRankLabel(tier: string): string {
  const normalized = normalizeRankTier(tier);
  const labels: Record<RankTier, string> = {
    pawn: "Pawn",
    knight: "Knight",
    bishop: "Bishop",
    rook: "Rook",
    queen: "Queen",
    king: "King",
  };
  return labels[normalized];
}

export function getRankAssetPath(tier: string): string {
  return `/assets/ranks/${normalizeRankTier(tier)}.svg`;
}

export interface BotSkillProfile {
  tier: RankTier;
  captureWeight: number;
  checkWeight: number;
  dropChance: number;
  blunderChance: number;
  thinkMinMs: number;
  thinkMaxMs: number;
  /** Fairy-Stockfish UCI_Elo (500–2850). */
  uciElo: number;
  /** Fairy-Stockfish Skill Level (0–20). */
  skillLevel: number;
  /** Engine search budget per move (ms). */
  moveTimeMs: number;
}

export function getBotSkillProfile(tier: RankTier | string): BotSkillProfile {
  const rank = normalizeRankTier(tier);
  const profiles: Record<RankTier, BotSkillProfile> = {
    pawn: {
      tier: "pawn",
      captureWeight: 0.35,
      checkWeight: 0.15,
      dropChance: 0.06,
      blunderChance: 0.42,
      thinkMinMs: 350,
      thinkMaxMs: 950,
      uciElo: 800,
      skillLevel: 2,
      moveTimeMs: 60,
    },
    knight: {
      tier: "knight",
      captureWeight: 0.62,
      checkWeight: 0.4,
      dropChance: 0.14,
      blunderChance: 0.12,
      thinkMinMs: 480,
      thinkMaxMs: 1150,
      uciElo: 1200,
      skillLevel: 6,
      moveTimeMs: 90,
    },
    bishop: {
      tier: "bishop",
      captureWeight: 0.68,
      checkWeight: 0.46,
      dropChance: 0.16,
      blunderChance: 0.1,
      thinkMinMs: 540,
      thinkMaxMs: 1300,
      uciElo: 1450,
      skillLevel: 9,
      moveTimeMs: 120,
    },
    rook: {
      tier: "rook",
      captureWeight: 0.78,
      checkWeight: 0.56,
      dropChance: 0.2,
      blunderChance: 0.06,
      thinkMinMs: 620,
      thinkMaxMs: 1500,
      uciElo: 1700,
      skillLevel: 12,
      moveTimeMs: 150,
    },
    queen: {
      tier: "queen",
      captureWeight: 0.88,
      checkWeight: 0.66,
      dropChance: 0.26,
      blunderChance: 0.03,
      thinkMinMs: 700,
      thinkMaxMs: 1750,
      uciElo: 2000,
      skillLevel: 16,
      moveTimeMs: 200,
    },
    king: {
      tier: "king",
      captureWeight: 0.94,
      checkWeight: 0.78,
      dropChance: 0.32,
      blunderChance: 0.015,
      thinkMinMs: 800,
      thinkMaxMs: 2100,
      uciElo: 2300,
      skillLevel: 20,
      moveTimeMs: 280,
    },
  };
  return profiles[rank];
}

export const RANK_TIER_ORDER: RankTier[] = [
  "pawn",
  "knight",
  "bishop",
  "rook",
  "queen",
  "king",
];

export interface RankLadderEntry {
  tier: RankTier;
  label: string;
  minRating: number;
  maxRating: number | null;
}

export const RANK_LADDER: RankLadderEntry[] = [
  { tier: "pawn", label: "Pawn", minRating: 0, maxRating: 1199 },
  { tier: "knight", label: "Knight", minRating: 1200, maxRating: 1399 },
  { tier: "bishop", label: "Bishop", minRating: 1400, maxRating: 1599 },
  { tier: "rook", label: "Rook", minRating: 1600, maxRating: 1899 },
  { tier: "queen", label: "Queen", minRating: 1900, maxRating: 2199 },
  { tier: "king", label: "King", minRating: 2200, maxRating: null },
];

export function formatRankRatingRange(entry: RankLadderEntry): string {
  if (entry.maxRating == null) return `${entry.minRating}+ ELO`;
  return `${entry.minRating}–${entry.maxRating} ELO`;
}

export function getNextRankProgress(rating: number): {
  nextTier: RankTier;
  nextLabel: string;
  pointsNeeded: number;
} | null {
  const currentTier = getRankTier(rating);
  const currentIdx = RANK_TIER_ORDER.indexOf(currentTier);
  if (currentIdx >= RANK_TIER_ORDER.length - 1) return null;
  const next = RANK_LADDER[currentIdx + 1]!;
  return {
    nextTier: next.tier,
    nextLabel: next.label,
    pointsNeeded: Math.max(0, next.minRating - rating),
  };
}

const TIER_RATING_FLOOR: Record<RankTier, number> = {
  pawn: 0,
  knight: 1200,
  bishop: 1400,
  rook: 1600,
  queen: 1900,
  king: 2200,
};

function bumpRankTier(tier: RankTier, steps: number): RankTier {
  const idx = RANK_TIER_ORDER.indexOf(tier);
  const next = Math.min(Math.max(idx + steps, 0), RANK_TIER_ORDER.length - 1);
  return RANK_TIER_ORDER[next]!;
}

function lerpSkillProfile(
  a: BotSkillProfile,
  b: BotSkillProfile,
  t: number
): BotSkillProfile {
  const mix = (x: number, y: number) => x + (y - x) * t;
  return {
    tier: t >= 0.5 ? b.tier : a.tier,
    captureWeight: mix(a.captureWeight, b.captureWeight),
    checkWeight: mix(a.checkWeight, b.checkWeight),
    dropChance: mix(a.dropChance, b.dropChance),
    blunderChance: mix(a.blunderChance, b.blunderChance),
    thinkMinMs: Math.round(mix(a.thinkMinMs, b.thinkMinMs)),
    thinkMaxMs: Math.round(mix(a.thinkMaxMs, b.thinkMaxMs)),
    uciElo: Math.round(mix(a.uciElo, b.uciElo)),
    skillLevel: Math.round(mix(a.skillLevel, b.skillLevel)),
    moveTimeMs: Math.round(mix(a.moveTimeMs, b.moveTimeMs)),
  };
}

/** Visible rank badge / bot name — matches the human queue rating. */
export function getBotDisplayTier(rating: number): RankTier {
  return getRankTier(rating);
}

/**
 * Actual bot strength — matches the human's rank tier (exact tier, no bump).
 * Stored on match players as `botSkill`; UI still uses `rankTier` for labels.
 */
export function getBotPlayTier(rating: number): RankTier {
  return getRankTier(rating);
}

/** Skill profile scaled to rating within the current rank band. */
export function getBotSkillForRating(rating: number): BotSkillProfile {
  const tier = getRankTier(rating);
  const floor = TIER_RATING_FLOOR[tier];
  const nextTier = bumpRankTier(tier, 1);
  const ceiling =
    nextTier === tier ? floor + 200 : TIER_RATING_FLOOR[nextTier];
  const span = Math.max(ceiling - floor, 1);
  const t = Math.min(1, Math.max(0, (rating - floor) / span));
  const profile = lerpSkillProfile(
    getBotSkillProfile(tier),
    getBotSkillProfile(nextTier),
    t
  );
  // UCI_Elo tracks the player's rating within Fairy-Stockfish's supported range.
  profile.uciElo = Math.max(500, Math.min(2850, Math.round(rating)));
  return profile;
}
