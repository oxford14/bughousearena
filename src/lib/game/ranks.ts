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
      captureWeight: 0.5,
      checkWeight: 0.28,
      dropChance: 0.1,
      blunderChance: 0.28,
      thinkMinMs: 450,
      thinkMaxMs: 1100,
    },
    bishop: {
      tier: "bishop",
      captureWeight: 0.62,
      checkWeight: 0.4,
      dropChance: 0.14,
      blunderChance: 0.18,
      thinkMinMs: 550,
      thinkMaxMs: 1300,
    },
    rook: {
      tier: "rook",
      captureWeight: 0.74,
      checkWeight: 0.52,
      dropChance: 0.2,
      blunderChance: 0.1,
      thinkMinMs: 650,
      thinkMaxMs: 1500,
    },
    queen: {
      tier: "queen",
      captureWeight: 0.86,
      checkWeight: 0.68,
      dropChance: 0.28,
      blunderChance: 0.05,
      thinkMinMs: 750,
      thinkMaxMs: 1800,
    },
    king: {
      tier: "king",
      captureWeight: 0.94,
      checkWeight: 0.82,
      dropChance: 0.34,
      blunderChance: 0.02,
      thinkMinMs: 900,
      thinkMaxMs: 2200,
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
