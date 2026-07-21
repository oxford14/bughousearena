import type { OnlineStatus } from "@/types/firestore";

/** Heartbeat interval in PresenceProvider — keep in sync. */
export const PRESENCE_HEARTBEAT_MS = 2 * 60 * 1000;

/**
 * Treat presence as offline when lastOnline is older than this.
 * Covers unclean exits where beforeunload never flushed "offline".
 */
export const PRESENCE_STALE_MS = 5 * 60 * 1000;

export function resolveOnlineStatus(
  stored: unknown,
  lastOnline: Date | null | undefined,
  nowMs: number = Date.now()
): OnlineStatus {
  const status: OnlineStatus =
    stored === "online" || stored === "away" || stored === "offline"
      ? stored
      : "offline";

  if (status === "offline") return "offline";
  if (!lastOnline || Number.isNaN(lastOnline.getTime())) return "offline";
  if (nowMs - lastOnline.getTime() > PRESENCE_STALE_MS) return "offline";
  return status;
}
