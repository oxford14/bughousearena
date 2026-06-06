import type { MatchHistoryEntry, MatchMode } from "@/types/firestore";

export interface ModeWinLoss {
  wins: number;
  losses: number;
  draws: number;
}

export function formatWinRate(wins: number, losses: number): string {
  const total = wins + losses;
  if (total === 0) return "—";
  return `${Math.round((wins / total) * 100)}%`;
}

export function getModeWinLoss(
  history: MatchHistoryEntry[],
  mode: Extract<MatchMode, "casual" | "ranked">
): ModeWinLoss {
  const games = history.filter((entry) => entry.mode === mode);
  return {
    wins: games.filter((entry) => entry.result === "win").length,
    losses: games.filter((entry) => entry.result === "loss").length,
    draws: games.filter((entry) => entry.result === "draw").length,
  };
}
