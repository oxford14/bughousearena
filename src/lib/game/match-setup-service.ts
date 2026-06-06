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
  resolveTeamSeating,
} from "@/lib/game/match-setup";
import { BOARD_IDS, getSeatColor, type BoardSeatId } from "@/lib/game/bughouse-engine";
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
    // Seat players on the board matching their chosen color (may swap boards).
    const updatedPlayers = resolveTeamSeating(players, choices);

    transaction.update(matchRef, {
      status: "active",
      players: updatedPlayers.map(serializeMatchPlayer),
      playerUids: updatedPlayers.filter((p) => !p.isBot).map((p) => p.uid),
      botUids: updatedPlayers.filter((p) => p.isBot).map((p) => p.uid),
      hasBots: updatedPlayers.some((p) => p.isBot),
      startedAt: serverTimestamp(),
      setupEndsAt: null,
    });

    // Reassign each board's occupant (seats can swap) and pause clocks until
    // the first move is played anywhere in the match.
    for (const boardId of BOARD_IDS) {
      const player = updatedPlayers.find((p) => p.boardId === boardId);
      const boardRef = doc(db, "matches", matchId, "boards", boardId);
      transaction.update(boardRef, {
        clockRunning: null,
        clockUpdatedAtMs: null,
        playerUid: player?.uid ?? "",
        playerColor: player?.playerColor ?? getSeatColor(boardId as BoardSeatId),
      });
    }

    return true;
  });
}

export function createSetupEndsTimestamp(
  durationSec = MATCH_SETUP_DURATION_SEC
): Timestamp {
  return Timestamp.fromMillis(Date.now() + durationSec * 1000);
}
