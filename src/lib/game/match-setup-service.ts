import {
  addDoc,
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/config";
import { serializeMatchPlayer, serializeBoard } from "@/lib/firebase/firestore-write";
import {
  MATCH_SETUP_DURATION_SEC,
  dedupePlayersByUid,
  resolveMatchColors,
} from "@/lib/game/match-setup";
import { BOARD_IDS } from "@/lib/game/bughouse-engine";
import type {
  MatchDocument,
  MatchSetupChatMessage,
  PlayerColor,
} from "@/types/firestore";

export function getSetupEndsAtMs(match: MatchDocument): number | null {
  const ends = match.setupEndsAt;
  if (!ends) return null;
  return ends.toMillis();
}

export async function submitColorChoice(
  matchId: string,
  uid: string,
  color: PlayerColor
): Promise<void> {
  const matchRef = doc(getFirebaseDb(), "matches", matchId);
  await updateDoc(matchRef, {
    [`colorChoices.${uid}`]: color,
  });
}

export async function sendSetupTeamChat(
  matchId: string,
  team: 1 | 2,
  uid: string,
  displayName: string,
  text: string
): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return;
  await addDoc(collection(getFirebaseDb(), "matches", matchId, "setupChat"), {
    team,
    uid,
    displayName,
    text: trimmed.slice(0, 500),
    createdAt: serverTimestamp(),
  });
}

export function subscribeSetupTeamChat(
  matchId: string,
  team: 1 | 2,
  onMessages: (messages: MatchSetupChatMessage[]) => void
): () => void {
  const q = query(
    collection(getFirebaseDb(), "matches", matchId, "setupChat"),
    where("team", "==", team),
    orderBy("createdAt", "asc"),
    limit(100)
  );

  return onSnapshot(
    q,
    (snap) => {
      const messages = snap.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as MatchSetupChatMessage
      );
      onMessages(messages);
    },
    (error) => {
      console.warn("[setup-chat] listener error", error.code, error.message);
    }
  );
}

export async function finalizeMatchSetup(matchId: string): Promise<boolean> {
  const db = getFirebaseDb();
  const matchRef = doc(db, "matches", matchId);

  return runTransaction(db, async (transaction) => {
    const matchSnap = await transaction.get(matchRef);
    if (!matchSnap.exists()) return false;

    const match = { id: matchSnap.id, ...matchSnap.data() } as MatchDocument;
    if (match.status !== "setup") return false;

    const endsMs = match.setupEndsAt?.toMillis() ?? 0;
    if (Date.now() < endsMs) return false;

    const choices = match.colorChoices ?? {};
    const players = dedupePlayersByUid(match.players);
    const resolved = resolveMatchColors(players, choices);

    const updatedPlayers = players.map((player) => ({
      ...player,
      playerColor: resolved[player.uid] ?? player.playerColor,
    }));

    transaction.update(matchRef, {
      status: "active",
      players: updatedPlayers.map(serializeMatchPlayer),
      startedAt: serverTimestamp(),
      setupEndsAt: null,
    });

    const nowMs = Date.now();
    for (const boardId of BOARD_IDS) {
      const player = updatedPlayers.find((p) => p.boardId === boardId);
      const boardRef = doc(db, "matches", matchId, "boards", boardId);
      const payload: Record<string, unknown> = {
        clockRunning: "w",
        clockUpdatedAtMs: nowMs,
      };
      if (player?.playerColor) {
        payload.playerColor = player.playerColor;
      }
      transaction.update(boardRef, payload);
    }

    return true;
  });
}

export function createSetupEndsTimestamp(
  durationSec = MATCH_SETUP_DURATION_SEC
): Timestamp {
  return Timestamp.fromMillis(Date.now() + durationSec * 1000);
}
