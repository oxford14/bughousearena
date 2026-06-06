import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/config";
import type { MatchHistoryEntry, MatchMode } from "@/types/firestore";

export async function saveMatchHistory(
  uid: string,
  entry: Omit<MatchHistoryEntry, "completedAt">
): Promise<void> {
  await addDoc(collection(getFirebaseDb(), "matchHistory", uid, "games"), {
    ...entry,
    completedAt: serverTimestamp(),
  });
}

export function subscribeToMatchHistory(
  uid: string,
  callback: (entries: MatchHistoryEntry[]) => void
): () => void {
  return onSnapshot(
    query(
      collection(getFirebaseDb(), "matchHistory", uid, "games"),
      orderBy("completedAt", "desc")
    ),
    (snap) => {
      callback(
        snap.docs.map(
          (d) => ({ matchId: d.id, ...d.data() }) as MatchHistoryEntry
        )
      );
    }
  );
}

export function formatMatchResult(result: MatchHistoryEntry["result"]): string {
  if (result === "win") return "Victory";
  if (result === "loss") return "Defeat";
  return "Draw";
}

export function formatMatchMode(mode: MatchMode): string {
  return mode.charAt(0).toUpperCase() + mode.slice(1);
}
