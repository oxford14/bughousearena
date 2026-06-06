import type { MatchmakingMember } from "@/types/firestore";
import type { RankTier } from "./ranks";
import {
  getBotDisplayTier,
  getBotPlayTier,
  getBotSkillForRating,
  getBotSkillProfile,
  getRankLabel,
} from "./ranks";

/** Wait this long before filling empty slots with arena bots. */
export const BOT_QUEUE_TIMEOUT_MS = 25_000;
export const BOT_BACKFILL_RETRY_MS = 5_000;

export const BOT_UID_PREFIX = "bot:";

export function isBotUid(uid: string): boolean {
  return uid.startsWith(BOT_UID_PREFIX);
}

interface BotPersona {
  id: string;
  suffix: string;
}

const BOT_PERSONAS: BotPersona[] = [
  { id: "swift", suffix: "Swift" },
  { id: "iron", suffix: "Iron" },
  { id: "shadow", suffix: "Shadow" },
  { id: "storm", suffix: "Storm" },
  { id: "neon", suffix: "Neon" },
  { id: "arena", suffix: "Arena" },
];

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

function ratingForTier(tier: RankTier, targetRating: number): number {
  const tierMid: Record<RankTier, number> = {
    pawn: 1050,
    knight: 1200,
    bishop: 1400,
    rook: 1600,
    queen: 1900,
    king: 2200,
  };
  return Math.round(targetRating * 0.55 + tierMid[tier] * 0.45);
}

/** Peak human rating in the queue — bots scale to the strongest human present. */
function peakHumanRating(humanMembers: MatchmakingMember[]): number {
  if (humanMembers.length === 0) return 1200;
  return Math.max(...humanMembers.map((m) => m.rating));
}

/** Pick bot players scaled to the human queue rating / rank tier. */
export function pickBots(
  count: number,
  humanMembers: MatchmakingMember[]
): MatchmakingMember[] {
  const targetRating = peakHumanRating(humanMembers);
  const displayTier = getBotDisplayTier(targetRating);
  const playTier = getBotPlayTier(targetRating);
  const personas = shuffle(BOT_PERSONAS).slice(0, count);

  return personas.map((persona, index) => {
    const label = getRankLabel(displayTier);
    return {
      uid: `${BOT_UID_PREFIX}${persona.id}-${displayTier}-${index}`,
      displayName: `${persona.suffix} ${label}`,
      photoURL: null,
      rating: ratingForTier(displayTier, targetRating),
      isBot: true,
      botSkill: playTier,
      rankTier: displayTier,
    };
  });
}

/** Build queue units when filling empty slots with bots. */
export function buildBotFillUnits(
  humans: MatchmakingMember[],
  bots: MatchmakingMember[],
  options?: { teammates?: boolean }
): MatchmakingMember[][] {
  if (humans.length + bots.length !== 4) {
    throw new Error(`Expected 4 total players, got ${humans.length + bots.length}`);
  }

  // Party / friends: humans share a team, both bots are opponents.
  if (options?.teammates && humans.length === 2 && bots.length === 2) {
    return [[humans[0]!, humans[1]!], [bots[0]!, bots[1]!]];
  }

  if (humans.length === 2 && bots.length === 2) {
    const pairA: MatchmakingMember[] = [humans[0]!, bots[0]!];
    const pairB: MatchmakingMember[] = [humans[1]!, bots[1]!];
    return Math.random() < 0.5 ? [pairA, pairB] : [pairB, pairA];
  }

  if (humans.length === 1 && bots.length === 3) {
    return [[humans[0]!], [bots[0]!], [bots[1]!], [bots[2]!]];
  }

  if (humans.length === 3 && bots.length === 1) {
    return [[humans[0]!], [humans[1]!], [humans[2]!], [bots[0]!]];
  }

  throw new Error("Unsupported bot fill composition");
}

export function getBotSkillForMember(member: {
  botSkill?: RankTier | string;
  rankTier?: RankTier | string;
  rating?: number;
}) {
  if (member.rating != null) return getBotSkillForRating(member.rating);
  if (member.botSkill) return getBotSkillProfile(member.botSkill);
  if (member.rankTier) return getBotSkillProfile(member.rankTier);
  return getBotSkillForRating(1200);
}
