const MANILA_TZ = "Asia/Manila";

/** Coins per streak day (1-indexed). Day 7+ stays at 25. */
export const DAILY_STREAK_REWARDS = [5, 8, 10, 12, 15, 20, 25] as const;

export function getManilaDateKey(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: MANILA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function getPreviousManilaDateKey(date = new Date()): string {
  const yesterday = new Date(date);
  yesterday.setDate(yesterday.getDate() - 1);
  return getManilaDateKey(yesterday);
}

export function getStreakRewardCoins(streakDay: number): number {
  const index = Math.min(Math.max(streakDay, 1), 7) - 1;
  return DAILY_STREAK_REWARDS[index]!;
}

export function computeNextStreak(
  lastClaimDateKey: string | null | undefined,
  currentStreak: number | undefined,
  todayKey: string
): { streak: number; alreadyClaimed: boolean } {
  if (lastClaimDateKey === todayKey) {
    return { streak: currentStreak ?? 1, alreadyClaimed: true };
  }

  const yesterdayKey = getPreviousManilaDateKey();
  if (lastClaimDateKey === yesterdayKey) {
    const next = Math.min((currentStreak ?? 0) + 1, 7);
    return { streak: next, alreadyClaimed: false };
  }

  return { streak: 1, alreadyClaimed: false };
}
