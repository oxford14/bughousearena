import type { MatchMode } from "@/types/firestore";
import type { MatchmakingEntry } from "@/types/firestore";

export const STANDARD_TIME_CONTROL_SEC = 300;
export const BLITZ_TIME_CONTROL_SEC = 60;
export const RANKED_TIME_CONTROL_SEC = 300;

export const CASUAL_TIME_CONTROLS = [
  { seconds: STANDARD_TIME_CONTROL_SEC, label: "5 min", shortLabel: "5+0" },
  { seconds: BLITZ_TIME_CONTROL_SEC, label: "1 min blitz", shortLabel: "1+0" },
] as const;

export type CasualTimeControlSec =
  (typeof CASUAL_TIME_CONTROLS)[number]["seconds"];

export function formatTimeControl(seconds: number): string {
  if (seconds % 60 === 0 && seconds >= 60) {
    const mins = seconds / 60;
    return mins === 1 ? "1 min" : `${mins} min`;
  }
  return `${seconds}s`;
}

export function resolveQueueTimeControl(entry: {
  mode: MatchMode;
  timeControl?: number;
}): number {
  if (entry.mode === "ranked") return RANKED_TIME_CONTROL_SEC;
  return entry.timeControl ?? STANDARD_TIME_CONTROL_SEC;
}

/** Only match queue entries that share the same clock setting. */
export function filterQueueByTimeControl<T extends { mode: MatchMode; timeControl?: number }>(
  entries: T[],
  anchor: T
): T[] {
  const target = resolveQueueTimeControl(anchor);
  return entries.filter((e) => resolveQueueTimeControl(e) === target);
}

export function getCasualTimeControlLabel(seconds: number): string {
  return (
    CASUAL_TIME_CONTROLS.find((o) => o.seconds === seconds)?.label ??
    formatTimeControl(seconds)
  );
}

export function matchTimeControlSeconds(match: {
  timeControl?: number;
  teamClocks?: { team1: number; team2: number };
}): number {
  return match.timeControl ?? match.teamClocks?.team1 ?? STANDARD_TIME_CONTROL_SEC;
}

export function isSameQueuePool(a: MatchmakingEntry, b: MatchmakingEntry): boolean {
  return a.mode === b.mode && resolveQueueTimeControl(a) === resolveQueueTimeControl(b);
}
