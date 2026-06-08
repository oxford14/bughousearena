import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/config";
import type { MatchHistoryEntry, MatchMode } from "@/types/firestore";

export async function saveMatchHistory(
  uid: string,
  entry: Omit<MatchHistoryEntry, "completedAt" | "id">
): Promise<void> {
  await setDoc(
    doc(getFirebaseDb(), "matchHistory", uid, "games", entry.matchId),
    {
      ...entry,
      completedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

function mapHistoryDoc(
  docId: string,
  data: Record<string, unknown>
): MatchHistoryEntry {
  return {
    id: docId,
    matchId: (data.matchId as string) ?? docId,
    mode: data.mode as MatchHistoryEntry["mode"],
    result: data.result as MatchHistoryEntry["result"],
    opponents: (data.opponents as string[]) ?? [],
    duration: (data.duration as number) ?? 0,
    ratingChange: (data.ratingChange as number) ?? 0,
    completedAt: data.completedAt as MatchHistoryEntry["completedAt"],
  };
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
      const entries = snap.docs.map((d) => mapHistoryDoc(d.id, d.data()));
      const seenMatchIds = new Set<string>();
      const deduped = entries.filter((entry) => {
        if (seenMatchIds.has(entry.matchId)) return false;
        seenMatchIds.add(entry.matchId);
        return true;
      });

      callback(deduped);
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
