import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/config";
import type { LeaderboardEntry } from "@/types/firestore";

export type LeaderboardType = "global" | "houses" | "seasonal";

export function subscribeToGlobalLeaderboard(
  callback: (entries: LeaderboardEntry[]) => void
): () => void {
  return onSnapshot(
    query(
      collection(getFirebaseDb(), "leaderboards", "global", "entries"),
      orderBy("rating", "desc"),
      limit(50)
    ),
    (snap) => {
      callback(
        snap.docs.map((d, i) => ({
          id: d.id,
          rank: i + 1,
          ...d.data(),
        }) as LeaderboardEntry)
      );
    }
  );
}

export function subscribeToHouseLeaderboard(
  callback: (entries: LeaderboardEntry[]) => void
): () => void {
  return onSnapshot(
    query(
      collection(getFirebaseDb(), "leaderboards", "houses", "entries"),
      orderBy("rating", "desc"),
      limit(50)
    ),
    (snap) => {
      callback(
        snap.docs.map((d, i) => ({
          id: d.id,
          rank: i + 1,
          ...d.data(),
        }) as LeaderboardEntry)
      );
    }
  );
}

export function subscribeToSeasonalLeaderboard(
  seasonId: string,
  callback: (entries: LeaderboardEntry[]) => void
): () => void {
  return onSnapshot(
    query(
      collection(getFirebaseDb(), "leaderboards", `season-${seasonId}`, "entries"),
      orderBy("rating", "desc"),
      limit(50)
    ),
    (snap) => {
      callback(
        snap.docs.map((d, i) => ({
          id: d.id,
          rank: i + 1,
          ...d.data(),
        }) as LeaderboardEntry)
      );
    }
  );
}

export async function syncUserToLeaderboard(
  uid: string,
  displayName: string,
  photoURL: string | null,
  rating: number,
  wins: number
): Promise<void> {
  await setDoc(doc(getFirebaseDb(), "leaderboards", "global", "entries", uid), {
    displayName,
    photoURL,
    rating,
    wins,
  });
}

export async function getFriendsLeaderboard(
  friendIds: string[]
): Promise<LeaderboardEntry[]> {
  if (friendIds.length === 0) return [];
  const entries: LeaderboardEntry[] = [];
  for (const id of friendIds) {
    const snap = await getDocs(
      query(collection(getFirebaseDb(), "leaderboards", "global", "entries"))
    );
    const found = snap.docs.find((d) => d.id === id);
    if (found) {
      entries.push({ id: found.id, rank: 0, ...found.data() } as LeaderboardEntry);
    }
  }
  return entries.sort((a, b) => b.rating - a.rating).map((e, i) => ({ ...e, rank: i + 1 }));
}
