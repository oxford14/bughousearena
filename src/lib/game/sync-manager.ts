import {
  collection,
  doc,
  onSnapshot,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/config";
import type { BoardDocument, MatchDocument } from "@/types/firestore";

export function subscribeToMatch(
  matchId: string,
  onMatch: (match: MatchDocument | null) => void
): Unsubscribe {
  return onSnapshot(doc(getFirebaseDb(), "matches", matchId), (snap) => {
    if (!snap.exists()) {
      onMatch(null);
      return;
    }
    onMatch({ id: snap.id, ...snap.data() } as MatchDocument);
  });
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
