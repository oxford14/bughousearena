import {
  Timestamp,
  addDoc,
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/config";
import type { WorldChatMessage } from "@/types/firestore";

const MAX_TEXT = 500;
const MAX_MESSAGES = 100;

/** How far back to load on open / reload (not full history). */
export const WORLD_CHAT_LOOKBACK_MS = 10 * 60 * 1000;

export function getWorldChatSinceMs(nowMs = Date.now()): number {
  return nowMs - WORLD_CHAT_LOOKBACK_MS;
}

export async function sendWorldChatMessage(
  uid: string,
  displayName: string,
  text: string,
  photoURL?: string | null
): Promise<void> {
  const trimmed = text.trim().slice(0, MAX_TEXT);
  if (!trimmed) return;

  await addDoc(collection(getFirebaseDb(), "worldChat"), {
    uid,
    displayName,
    photoURL: photoURL ?? null,
    text: trimmed,
    createdAt: serverTimestamp(),
  });
}

/**
 * Live world chat from the last ~10 minutes onward.
 * Reload keeps that window; older history is not loaded.
 */
export function subscribeToWorldChat(
  callback: (messages: WorldChatMessage[]) => void,
  sinceMs: number = getWorldChatSinceMs()
): () => void {
  const since = Timestamp.fromMillis(sinceMs);

  return onSnapshot(
    query(
      collection(getFirebaseDb(), "worldChat"),
      where("createdAt", ">=", since),
      orderBy("createdAt", "asc"),
      limit(MAX_MESSAGES)
    ),
    (snap) => {
      const messages = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }) as WorldChatMessage)
        .filter((msg) => {
          const created = msg.createdAt?.toMillis?.();
          if (created == null) return true;
          return created >= sinceMs;
        });
      callback(messages);
    },
    (error) => {
      console.error("[world-chat] subscribe failed", error);
      callback([]);
    }
  );
}
