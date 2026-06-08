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
import type { ChatScope, MatchChatMessage } from "@/types/firestore";

export async function sendMatchTeamChat(
  matchId: string,
  team: 1 | 2,
  uid: string,
  displayName: string,
  text: string,
  scope: ChatScope = "team",
  templateId?: string,
  emoteId?: string,
  vipLevel?: number
): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return;

  const audience: (1 | 2)[] = scope === "all" ? [1, 2] : [team];

  await addDoc(collection(getFirebaseDb(), "matches", matchId, "chat"), {
    team,
    scope,
    audience,
    uid,
    displayName,
    text: trimmed.slice(0, 500),
    ...(typeof vipLevel === "number" && vipLevel > 0 ? { vipLevel } : {}),
    ...(templateId ? { templateId } : {}),
    ...(emoteId ? { emoteId } : {}),
    createdAt: serverTimestamp(),
  });
}

function sortMessages(messages: MatchChatMessage[]): MatchChatMessage[] {
  return [...messages].sort(
    (a, b) => (a.createdAt?.toMillis?.() ?? 0) - (b.createdAt?.toMillis?.() ?? 0)
  );
}

function mergeMessages(
  target: Map<string, MatchChatMessage>,
  docs: { id: string; data: () => unknown }[]
): void {
  for (const docSnap of docs) {
    target.set(docSnap.id, {
      id: docSnap.id,
      ...(docSnap.data() as Omit<MatchChatMessage, "id">),
    });
  }
}

export function subscribeMatchTeamChat(
  matchId: string,
  team: 1 | 2,
  onMessages: (messages: MatchChatMessage[]) => void
): () => void {
  const db = getFirebaseDb();
  const chatRef = collection(db, "matches", matchId, "chat");
  const merged = new Map<string, MatchChatMessage>();

  const emit = () => {
    onMessages(sortMessages(Array.from(merged.values())));
  };

  // New messages: team-scoped + all-team broadcasts (no orderBy — avoids composite index).
  const audienceUnsub = onSnapshot(
    query(chatRef, where("audience", "array-contains", team), limit(100)),
    (snap) => {
      mergeMessages(merged, snap.docs);
      emit();
    },
    (error) => {
      console.warn("[match-chat] audience listener error", error.code, error.message);
    }
  );

  // Legacy messages written before audience/scope existed (uses existing team index).
  const teamUnsub = onSnapshot(
    query(chatRef, where("team", "==", team), orderBy("createdAt", "asc"), limit(100)),
    (snap) => {
      mergeMessages(merged, snap.docs);
      emit();
    },
    (error) => {
      console.warn("[match-chat] team listener error", error.code, error.message);
    }
  );

  return () => {
    audienceUnsub();
    teamUnsub();
  };
}
