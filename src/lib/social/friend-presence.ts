import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/config";
import { resolveOnlineStatus } from "@/lib/social/presence";
import type { OnlineStatus } from "@/types/firestore";

/** Display-facing friend activity (priority: match > queue > presence). */
export type FriendActivityStatus =
  | "in_match"
  | "in_queue"
  | "online"
  | "away"
  | "offline";

export interface FriendPresence {
  uid: string;
  /** Resolved presence from user doc (stale-aware). */
  onlineStatus: OnlineStatus;
  inMatch: boolean;
  inQueue: boolean;
  matchId: string | null;
  /** Badge label source. */
  activity: FriendActivityStatus;
}

function toDate(value: unknown): Date | null {
  if (
    value &&
    typeof value === "object" &&
    typeof (value as { toDate?: () => Date }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate();
  }
  return null;
}

export function deriveFriendActivity(input: {
  onlineStatus: OnlineStatus;
  inMatch: boolean;
  inQueue: boolean;
}): FriendActivityStatus {
  if (input.inMatch) return "in_match";
  if (input.inQueue) return "in_queue";
  return input.onlineStatus;
}

export function friendActivityLabel(status: FriendActivityStatus): string {
  switch (status) {
    case "in_match":
      return "in match";
    case "in_queue":
      return "in queue";
    default:
      return status;
  }
}

function buildPresence(partial: {
  uid: string;
  onlineStatus: OnlineStatus;
  inMatch: boolean;
  inQueue: boolean;
  matchId: string | null;
}): FriendPresence {
  return {
    ...partial,
    activity: deriveFriendActivity(partial),
  };
}

/**
 * Live presence for a set of friend UIDs: online/away/offline (stale-aware),
 * plus in-queue (matchmaking) and in-match (active session + live match).
 */
export function subscribeToFriendsPresence(
  friendIds: string[],
  callback: (byUid: Record<string, FriendPresence>) => void
): () => void {
  const ids = [...new Set(friendIds.filter(Boolean))];
  if (ids.length === 0) {
    callback({});
    return () => {};
  }

  const db = getFirebaseDb();
  const onlineByUid: Record<string, OnlineStatus> = {};
  const inQueueByUid: Record<string, boolean> = {};
  const matchIdByUid: Record<string, string | null> = {};
  const inMatchByUid: Record<string, boolean> = {};

  let cancelled = false;
  const unsubs: Array<() => void> = [];

  const emit = () => {
    if (cancelled) return;
    const next: Record<string, FriendPresence> = {};
    for (const uid of ids) {
      next[uid] = buildPresence({
        uid,
        onlineStatus: onlineByUid[uid] ?? "offline",
        inMatch: Boolean(inMatchByUid[uid]),
        inQueue: Boolean(inQueueByUid[uid]),
        matchId: matchIdByUid[uid] ?? null,
      });
    }
    callback(next);
  };

  for (const uid of ids) {
    onlineByUid[uid] = "offline";
    inQueueByUid[uid] = false;
    matchIdByUid[uid] = null;
    inMatchByUid[uid] = false;

    unsubs.push(
      onSnapshot(
        doc(db, "users", uid),
        (snap) => {
          if (!snap.exists()) {
            onlineByUid[uid] = "offline";
            emit();
            return;
          }
          const data = snap.data();
          onlineByUid[uid] = resolveOnlineStatus(
            data.onlineStatus,
            toDate(data.lastOnline)
          );
          emit();
        },
        () => {
          onlineByUid[uid] = "offline";
          emit();
        }
      )
    );

    unsubs.push(
      onSnapshot(
        doc(db, "users", uid, "session", "active"),
        async (snap) => {
          const matchId = (snap.data()?.matchId as string | undefined) ?? null;
          matchIdByUid[uid] = matchId;
          if (!matchId) {
            inMatchByUid[uid] = false;
            emit();
            return;
          }
          try {
            const matchSnap = await getDoc(doc(db, "matches", matchId));
            const status = matchSnap.data()?.status as string | undefined;
            inMatchByUid[uid] =
              matchSnap.exists() &&
              (status === "setup" || status === "active");
          } catch {
            inMatchByUid[uid] = false;
          }
          emit();
        },
        () => {
          matchIdByUid[uid] = null;
          inMatchByUid[uid] = false;
          emit();
        }
      )
    );

    unsubs.push(
      onSnapshot(
        query(
          collection(db, "matchmaking"),
          where("memberUids", "array-contains", uid)
        ),
        (snap) => {
          inQueueByUid[uid] = !snap.empty;
          emit();
        },
        () => {
          inQueueByUid[uid] = false;
          emit();
        }
      )
    );
  }

  emit();

  return () => {
    cancelled = true;
    for (const unsub of unsubs) unsub();
  };
}
