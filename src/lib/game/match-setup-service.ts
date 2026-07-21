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
import { SINGLE_BOARD_ID } from "@/lib/game/single-board-engine";
import { normalizeGameType } from "@/lib/game/game-types";
import { oppositeColor } from "@/lib/game/match-setup";
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
  text: string,
  vipLevel?: number
): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return;
  await addDoc(collection(getFirebaseDb(), "matches", matchId, "setupChat"), {
    team,
    uid,
    displayName,
    text: trimmed.slice(0, 500),
    ...(typeof vipLevel === "number" && vipLevel > 0 ? { vipLevel } : {}),
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
    const gameType = normalizeGameType(match.gameType);

    let updatedPlayers = players;
    if (gameType === "bughouse") {
      updatedPlayers = resolveTeamSeating(players, choices);
    } else {
      // 1v1: assign White/Black from choices (or random).
      const [p0, p1] = players;
      if (p0 && p1) {
        let c0 = choices[p0.uid];
        let c1 = choices[p1.uid];
        if (c0 && !c1) c1 = oppositeColor(c0);
        else if (!c0 && c1) c0 = oppositeColor(c1);
        else if (!c0 && !c1) {
          c0 = Math.random() < 0.5 ? "w" : "b";
          c1 = oppositeColor(c0);
        } else if (c0 && c1 && c0 === c1) {
          c0 = Math.random() < 0.5 ? "w" : "b";
          c1 = oppositeColor(c0);
        }
        updatedPlayers = [
          {
            ...p0,
            boardId: SINGLE_BOARD_ID,
            team: c0 === "w" ? 1 : 2,
            playerColor: c0!,
          },
          {
            ...p1,
            boardId: SINGLE_BOARD_ID,
            team: c1 === "w" ? 1 : 2,
            playerColor: c1!,
          },
        ];
      }
    }

    transaction.update(matchRef, {
      status: "active",
      players: updatedPlayers.map(serializeMatchPlayer),
      playerUids: updatedPlayers.filter((p) => !p.isBot).map((p) => p.uid),
      botUids: updatedPlayers.filter((p) => p.isBot).map((p) => p.uid),
      hasBots: updatedPlayers.some((p) => p.isBot),
      startedAt: serverTimestamp(),
      setupEndsAt: null,
    });

    if (gameType === "bughouse") {
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
    } else {
      const white = updatedPlayers.find((p) => p.playerColor === "w");
      const boardRef = doc(db, "matches", matchId, "boards", SINGLE_BOARD_ID);
      transaction.update(boardRef, {
        clockRunning: null,
        clockUpdatedAtMs: null,
        playerUid: white?.uid ?? "",
        playerColor: "w",
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
