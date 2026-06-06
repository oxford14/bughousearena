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
    },
    knight: {
      tier: "knight",
      captureWeight: 0.72,
      checkWeight: 0.48,
      dropChance: 0.18,
      blunderChance: 0.1,
      thinkMinMs: 550,
      thinkMaxMs: 1400,
    },
    bishop: {
      tier: "bishop",
      captureWeight: 0.82,
      checkWeight: 0.58,
      dropChance: 0.22,
      blunderChance: 0.06,
      thinkMinMs: 650,
      thinkMaxMs: 1600,
    },
    rook: {
      tier: "rook",
      captureWeight: 0.9,
      checkWeight: 0.68,
      dropChance: 0.28,
      blunderChance: 0.03,
      thinkMinMs: 750,
      thinkMaxMs: 1900,
    },
    queen: {
      tier: "queen",
      captureWeight: 0.96,
      checkWeight: 0.78,
      dropChance: 0.34,
      blunderChance: 0.015,
      thinkMinMs: 850,
      thinkMaxMs: 2200,
    },
    king: {
      tier: "king",
      captureWeight: 1,
      checkWeight: 0.88,
      dropChance: 0.4,
      blunderChance: 0.005,
      thinkMinMs: 1000,
      thinkMaxMs: 2600,
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
