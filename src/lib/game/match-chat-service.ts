import {
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
import type { MatchChatMessage } from "@/types/firestore";

export async function sendMatchTeamChat(
  matchId: string,
  team: 1 | 2,
  uid: string,
  displayName: string,
  text: string,
  templateId?: string
): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return;

  await addDoc(collection(getFirebaseDb(), "matches", matchId, "chat"), {
    team,
    uid,
    displayName,
    text: trimmed.slice(0, 500),
    ...(templateId ? { templateId } : {}),
    createdAt: serverTimestamp(),
  });
}

export function subscribeMatchTeamChat(
  matchId: string,
  team: 1 | 2,
  onMessages: (messages: MatchChatMessage[]) => void
): () => void {
  const q = query(
    collection(getFirebaseDb(), "matches", matchId, "chat"),
    where("team", "==", team),
    orderBy("createdAt", "asc"),
    limit(100)
  );

  return onSnapshot(
    q,
    (snap) => {
      const messages = snap.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as MatchChatMessage
      );
      onMessages(messages);
    },
    (error) => {
      console.warn("[match-chat] listener error", error.code, error.message);
    }
  );
}
