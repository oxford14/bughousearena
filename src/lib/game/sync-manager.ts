import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/config";
import type { BoardDocument, MatchDocument } from "@/types/firestore";
import { boardsSnapshotKey, matchSnapshotKey } from "@/lib/game/sync-snapshot-keys";

const lastMatchKeys = new Map<string, string>();
const lastBoardKeys = new Map<string, string>();

export async function waitForMatchDocument(
  matchId: string,
  options?: { timeoutMs?: number; intervalMs?: number }
): Promise<boolean> {
  const timeoutMs = options?.timeoutMs ?? 15000;
  const intervalMs = options?.intervalMs ?? 400;
  const ref = doc(getFirebaseDb(), "matches", matchId);
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const snap = await getDoc(ref);
    if (snap.exists()) return true;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return false;
}

export function subscribeToMatch(
  matchId: string,
  onMatch: (match: MatchDocument | null) => void
): Unsubscribe {
  return onSnapshot(
    doc(getFirebaseDb(), "matches", matchId),
    (snap) => {
      if (!snap.exists()) {
        lastMatchKeys.delete(matchId);
        onMatch(null);
        return;
      }
      const match = { id: snap.id, ...snap.data() } as MatchDocument;
      const key = matchSnapshotKey(match);
      if (lastMatchKeys.get(matchId) === key) return;
      lastMatchKeys.set(matchId, key);
      onMatch(match);
    },
    (error) => {
      console.warn("[match] listener error", error.code, error.message);
    }
  );
}

export function subscribeToBoards(
  matchId: string,
  onBoards: (boards: BoardDocument[]) => void
): Unsubscribe {
  return onSnapshot(
    collection(getFirebaseDb(), "matches", matchId, "boards"),
    (snap) => {
      const boards = snap.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as BoardDocument
      );
      const key = boardsSnapshotKey(boards);
      if (lastBoardKeys.get(matchId) === key) return;
      lastBoardKeys.set(matchId, key);
      onBoards(boards);
    }
  );
}

export function subscribeToMatchAndBoards(
  matchId: string,
  callbacks: {
    onMatch: (match: MatchDocument | null) => void;
    onBoards: (boards: BoardDocument[]) => void;
  }
): () => void {
  const unsubMatch = subscribeToMatch(matchId, callbacks.onMatch);
  const unsubBoards = subscribeToBoards(matchId, callbacks.onBoards);
  return () => {
    unsubMatch();
    unsubBoards();
  };
}
