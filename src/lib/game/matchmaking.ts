import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Transaction,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/config";
import {
  serializeBoard,
  serializeMatchPlayer,
} from "@/lib/firebase/firestore-write";
import type {
  MatchMode,
  MatchPlayer,
  MatchmakingEntry,
  MatchmakingMember,
  PartyDocument,
  PrivateRoom,
  UserProfile,
} from "@/types/firestore";
import { assignPlayersToBoards, createInitialBoards } from "./board-state";
import { createSetupEndsTimestamp } from "./match-setup-service";
import {
  assignPlayersFromUnits,
  averageRating,
  findQueueCombo,
} from "./team-builder";
import {
  BOT_BACKFILL_RETRY_MS,
  BOT_QUEUE_TIMEOUT_MS,
  buildBotFillUnits,
  isBotUid,
  pickBots,
} from "./bots";

export { BOT_QUEUE_TIMEOUT_MS, BOT_BACKFILL_RETRY_MS };

const DEFAULT_TIME_CONTROL = 300;

export function countLiveHumansInQueue(entries: MatchmakingEntry[]): number {
  const seen = new Set<string>();
  for (const entry of entries) {
    for (const member of entry.members) {
      if (member.isBot || isBotUid(member.uid)) continue;
      seen.add(member.uid);
    }
  }
  return seen.size;
}

function normalizeQueueEntry(
  id: string,
  data: Record<string, unknown>
): MatchmakingEntry {
  const members =
    (data.members as MatchmakingMember[] | undefined) ??
    [
      {
        uid: data.uid as string,
        displayName: data.displayName as string,
        photoURL: null,
        rating: (data.rating as number) ?? 1200,
      },
    ];
  return {
    id,
    uid: data.uid as string,
    displayName: data.displayName as string,
    mode: data.mode as MatchMode,
    rating: (data.rating as number) ?? averageRating(members),
    timestamp: data.timestamp as MatchmakingEntry["timestamp"],
    partyId: (data.partyId as string | null | undefined) ?? null,
    memberUids: (data.memberUids as string[] | undefined) ?? members.map((m) => m.uid),
    members,
  };
}

function toMatchmakingMember(user: UserProfile): MatchmakingMember {
  return {
    uid: user.uid,
    displayName: user.displayName,
    photoURL: user.photoURL,
    rating: user.rating,
  };
}

export async function joinQueue(
  user: UserProfile,
  mode: MatchMode,
  party?: PartyDocument | null
): Promise<string> {
  const members: MatchmakingMember[] = party?.members.length
    ? party.members.map((m) => ({
        uid: m.uid,
        displayName: m.displayName,
        photoURL: m.photoURL,
        rating: m.rating,
      }))
    : [toMatchmakingMember(user)];

  if (party && party.leaderUid !== user.uid) {
    throw new Error("Only the party leader can queue for matchmaking");
  }

  const ref = await addDoc(collection(getFirebaseDb(), "matchmaking"), {
    uid: user.uid,
    displayName: user.displayName,
    mode,
    rating: averageRating(members),
    timestamp: serverTimestamp(),
    partyId: party?.id ?? null,
    memberUids: members.map((m) => m.uid),
    members,
  });
  return ref.id;
}

export async function leaveQueue(queueId: string): Promise<void> {
  await deleteDoc(doc(getFirebaseDb(), "matchmaking", queueId));
}

export async function clearActiveMatchSession(uid: string): Promise<void> {
  await deleteDoc(doc(getFirebaseDb(), "users", uid, "session", "active")).catch(
    () => {}
  );
}

/** Drop stale session pointers; return a live match id if the player should rejoin. */
export async function reconcileActiveMatchSession(uid: string): Promise<string | null> {
  const db = getFirebaseDb();
  const sessionRef = doc(db, "users", uid, "session", "active");
  const sessionSnap = await getDoc(sessionRef);
  if (!sessionSnap.exists()) return null;

  const matchId = sessionSnap.data()?.matchId as string | undefined;
  if (!matchId) {
    await clearActiveMatchSession(uid);
    return null;
  }

  const matchSnap = await getDoc(doc(db, "matches", matchId));
  if (!matchSnap.exists()) {
    await clearActiveMatchSession(uid);
    return null;
  }

  const status = matchSnap.data()?.status as string | undefined;
  if (status === "completed" || status === "abandoned") {
    await clearActiveMatchSession(uid);
    return null;
  }

  return matchId;
}

export function subscribeToActiveMatch(
  uid: string,
  onFound: (matchId: string) => void
): () => void {
  return onSnapshot(
    doc(getFirebaseDb(), "users", uid, "session", "active"),
    (snap) => {
      const matchId = snap.data()?.matchId as string | undefined;
      if (matchId) onFound(matchId);
    }
  );
}

export function subscribeToQueue(
  uid: string,
  mode: MatchMode,
  queueEntryId: string,
  onFound: (matchId: string, options?: { usedBots?: boolean }) => void,
  onBotBackfillFailed?: (error?: unknown) => void,
  onQueueStats?: (stats: { liveHumans: number }) => void
): () => void {
  const q = query(
    collection(getFirebaseDb(), "matchmaking"),
    where("mode", "==", mode),
    limit(50)
  );

  let creating = false;
  let settled = false;
  const joinedAtMs = Date.now();

  const finish = (matchId: string, usedBots = false) => {
    if (settled) return;
    settled = true;
    onFound(matchId, { usedBots });
  };

  const entryWaitMs = (entry: MatchmakingEntry | undefined) => {
    if (!entry?.timestamp?.toMillis) return Date.now() - joinedAtMs;
    return Date.now() - entry.timestamp.toMillis();
  };

  const entryRef = doc(getFirebaseDb(), "matchmaking", queueEntryId);

  const attemptBotBackfill = (reason: string) => {
    if (settled || creating) return;
    creating = true;
    void tryCreateBotMatch(queueEntryId, mode)
      .then((matchId) => {
        if (matchId) {
          finish(matchId, true);
          return;
        }
        console.warn(`[matchmaking] bot backfill failed (${reason})`);
        onBotBackfillFailed?.(new Error(`bot backfill failed: ${reason}`));
      })
      .catch((error) => {
        console.warn(`[matchmaking] bot backfill error (${reason})`, error);
        onBotBackfillFailed?.(error);
      })
      .finally(() => {
        creating = false;
      });
  };

  const unsubOwnEntry = onSnapshot(entryRef, (snap) => {
    if (settled || creating) return;
    if (!snap.exists()) return;

    const entry = normalizeQueueEntry(
      queueEntryId,
      snap.data() as Record<string, unknown>
    );
    if (entryWaitMs(entry) >= BOT_QUEUE_TIMEOUT_MS) {
      attemptBotBackfill("own-entry");
    }
  });

  const unsub = onSnapshot(q, async (snap) => {
    if (creating || settled) return;

    const entries = snap.docs.map((d) => normalizeQueueEntry(d.id, d.data()));
    onQueueStats?.({ liveHumans: countLiveHumansInQueue(entries) });
    const myEntry = entries.find((e) => e.id === queueEntryId);

    const combo = myEntry ? findQueueCombo(entries, queueEntryId) : null;
    if (combo) {
      creating = true;
      try {
        const matchId = await createMatchFromQueue(combo, mode);
        if (matchId) finish(matchId, false);
      } finally {
        creating = false;
      }
      return;
    }

    if (myEntry && entryWaitMs(myEntry) >= BOT_QUEUE_TIMEOUT_MS) {
      attemptBotBackfill("timeout");
      return;
    }

    if (!myEntry && entryWaitMs(undefined) >= BOT_QUEUE_TIMEOUT_MS) {
      attemptBotBackfill("entry-missing");
    }
  });

  const initialDelay = Math.max(0, BOT_QUEUE_TIMEOUT_MS - (Date.now() - joinedAtMs));
  const botTimer = window.setTimeout(() => {
    attemptBotBackfill("timer");
  }, initialDelay);

  const botRetry = window.setInterval(() => {
    if (settled || Date.now() - joinedAtMs < BOT_QUEUE_TIMEOUT_MS) return;
    attemptBotBackfill("interval");
  }, BOT_BACKFILL_RETRY_MS);

  return () => {
    unsub();
    unsubOwnEntry();
    window.clearTimeout(botTimer);
    window.clearInterval(botRetry);
  };
}

export async function tryCreateBotMatch(
  queueEntryId: string,
  mode: MatchMode
): Promise<string | null> {
  return tryCreateBotMatchBatch(queueEntryId, mode);
}

/** Greedily bundle queue entries (starting with the anchor) up to 4 slots. */
function collectQueueEntriesForBotFill(
  entries: MatchmakingEntry[],
  anchorId: string
): MatchmakingEntry[] {
  const anchor = entries.find((e) => e.id === anchorId);
  if (!anchor) return [];

  const sorted = [...entries].sort((a, b) => {
    const ta = a.timestamp?.toMillis?.() ?? 0;
    const tb = b.timestamp?.toMillis?.() ?? 0;
    return ta - tb;
  });

  const selected: MatchmakingEntry[] = [anchor];
  let slots = anchor.members.length;

  for (const entry of sorted) {
    if (entry.id === anchorId) continue;
    if (slots + entry.members.length > 4) continue;

    const selectedUids = new Set(selected.flatMap((e) => e.memberUids));
    const sharesMember = entry.memberUids.some((uid) => selectedUids.has(uid));
    if (sharesMember) continue;

    selected.push(entry);
    slots += entry.members.length;
    if (slots >= 4) break;
  }

  return selected;
}

async function tryCreateBotMatchBatch(
  queueEntryId: string,
  mode: MatchMode
): Promise<string | null> {
  const db = getFirebaseDb();
  const entryRef = doc(db, "matchmaking", queueEntryId);
  const entrySnap = await getDoc(entryRef);
  if (!entrySnap.exists()) return null;

  const queueSnap = await getDocs(
    query(collection(db, "matchmaking"), where("mode", "==", mode), limit(50))
  );
  const entries = queueSnap.docs.map((d) =>
    normalizeQueueEntry(d.id, d.data() as Record<string, unknown>)
  );

  const selected = collectQueueEntriesForBotFill(entries, queueEntryId);
  if (selected.length === 0) return null;

  const seenHumanUids = new Set<string>();
  const humans = selected
    .flatMap((e) => e.members)
    .filter((m) => {
      if (m.isBot || isBotUid(m.uid)) return false;
      if (seenHumanUids.has(m.uid)) return false;
      seenHumanUids.add(m.uid);
      return true;
    });
  if (humans.length === 0) return null;

  const totalSlots = selected.reduce((sum, e) => sum + e.members.length, 0);
  if (totalSlots >= 4) return null;

  const slotsNeeded = 4 - totalSlots;
  if (slotsNeeded <= 0) return null;

  const bots = pickBots(slotsNeeded, humans);
  const units = buildBotFillUnits(humans, bots);
  const players: MatchPlayer[] = assignPlayersFromUnits(units);
  const queueEntryIds = selected.map((e) => e.id);

  try {
    return await runTransaction(db, async (transaction) => {
      for (const entry of selected) {
        const snap = await transaction.get(doc(db, "matchmaking", entry.id));
        if (!snap.exists()) return null;
      }

      return persistMatchInTransaction(transaction, db, {
        mode,
        players,
        queueEntryIds,
      });
    });
  } catch (error) {
    console.warn("[matchmaking] bot match transaction failed", error);
    return null;
  }
}

async function createMatchFromQueue(
  entries: MatchmakingEntry[],
  mode: MatchMode
): Promise<string | null> {
  const db = getFirebaseDb();
  const units = entries.map((e) => e.members);
  const players: MatchPlayer[] = assignPlayersFromUnits(units);

  try {
    return await runTransaction(db, async (transaction) => {
      for (const entry of entries) {
        const entryRef = doc(db, "matchmaking", entry.id);
        const entrySnap = await transaction.get(entryRef);
        if (!entrySnap.exists()) {
          return null;
        }
      }

      return persistMatchInTransaction(transaction, db, {
        mode,
        players,
        queueEntryIds: entries.map((e) => e.id),
      });
    });
  } catch {
    return null;
  }
}

function persistMatchInTransaction(
  transaction: Transaction,
  db: ReturnType<typeof getFirebaseDb>,
  opts: {
    mode: MatchMode;
    players: MatchPlayer[];
    queueEntryIds: string[];
  }
): string {
  const { mode, players, queueEntryIds } = opts;
  const humanUids = players.filter((p) => !p.isBot).map((p) => p.uid);
  const botUids = players.filter((p) => p.isBot).map((p) => p.uid);

  const matchRef = doc(collection(db, "matches"));
  transaction.set(matchRef, {
    mode,
    status: "setup",
    players: players.map(serializeMatchPlayer),
    playerUids: humanUids,
    botUids,
    hasBots: botUids.length > 0,
    colorChoices: {},
    setupEndsAt: createSetupEndsTimestamp(),
    teamClocks: { team1: DEFAULT_TIME_CONTROL, team2: DEFAULT_TIME_CONTROL },
    winnerTeam: null,
    createdAt: serverTimestamp(),
    startedAt: null,
    completedAt: null,
  });

  for (const board of createInitialBoards(players)) {
    transaction.set(doc(matchRef, "boards", board.id), serializeBoard(board));
  }

  for (const entryId of queueEntryIds) {
    transaction.delete(doc(db, "matchmaking", entryId));
  }

  for (const uid of humanUids) {
    transaction.set(doc(db, "users", uid, "session", "active"), {
      matchId: matchRef.id,
      mode,
      createdAt: serverTimestamp(),
    });
  }

  return matchRef.id;
}

export async function createPrivateRoom(
  host: UserProfile,
  mode: MatchMode = "private"
): Promise<string> {
  const code = Math.random().toString(36).slice(2, 8).toUpperCase();
  await setDoc(doc(getFirebaseDb(), "privateRooms", code), {
    code,
    hostId: host.uid,
    hostDisplayName: host.displayName,
    settings: { mode, timeControl: DEFAULT_TIME_CONTROL },
    players: [
      {
        uid: host.uid,
        displayName: host.displayName,
        photoURL: host.photoURL,
        boardId: "",
        team: 1,
        rating: host.rating,
      },
    ],
    status: "waiting",
    createdAt: serverTimestamp(),
  });
  return code;
}

export async function joinPrivateRoom(
  code: string,
  user: UserProfile
): Promise<PrivateRoom | null> {
  const roomRef = doc(getFirebaseDb(), "privateRooms", code.toUpperCase());
  const roomSnap = await getDoc(roomRef);
  if (!roomSnap.exists()) return null;

  const room = roomSnap.data() as PrivateRoom;
  if (room.players.some((p) => p.uid === user.uid)) return room;

  const players = [
    ...room.players,
    {
      uid: user.uid,
      displayName: user.displayName,
      photoURL: user.photoURL,
      boardId: "",
      team: 1 as const,
      rating: user.rating,
    },
  ];

  await updateDoc(roomRef, { players });

  if (players.length === 4) {
    const matchId = await startPrivateMatch(code, players, room.settings.mode);
    await updateDoc(roomRef, { status: "started", matchId });
  }

  return { ...room, players };
}

async function startPrivateMatch(
  code: string,
  players: MatchPlayer[],
  mode: MatchMode
): Promise<string> {
  const assigned = assignPlayersToBoards(players);
  const matchRef = doc(collection(getFirebaseDb(), "matches"));
  const batch = writeBatch(getFirebaseDb());

  batch.set(matchRef, {
    mode,
    status: "setup",
    players: assigned.map(serializeMatchPlayer),
    playerUids: assigned.filter((p) => !p.isBot).map((p) => p.uid),
    botUids: assigned.filter((p) => p.isBot).map((p) => p.uid),
    hasBots: assigned.some((p) => p.isBot),
    colorChoices: {},
    setupEndsAt: createSetupEndsTimestamp(),
    teamClocks: { team1: DEFAULT_TIME_CONTROL, team2: DEFAULT_TIME_CONTROL },
    winnerTeam: null,
    privateRoomCode: code,
    createdAt: serverTimestamp(),
    startedAt: null,
    completedAt: null,
  });

  for (const board of createInitialBoards(assigned)) {
    batch.set(doc(matchRef, "boards", board.id), serializeBoard(board));
  }

  await batch.commit();
  return matchRef.id;
}

export async function submitMove(
  matchId: string,
  boardId: string,
  playerId: string,
  move: string,
  _fen?: string,
  _captured?: string[],
  promotion?: import("./bughouse-engine").PieceSymbol
): Promise<void> {
  const { submitValidatedMove } = await import("./match-actions");
  const result = await submitValidatedMove({
    matchId,
    boardId,
    playerId,
    move,
    promotion,
  });
  if (!result.ok) {
    throw new Error(result.error ?? "Move rejected");
  }
}

export async function resignMatch(matchId: string, playerId: string): Promise<void> {
  const { submitResign } = await import("./match-actions");
  const result = await submitResign(matchId, playerId);
  if (!result.ok) {
    throw new Error(result.error ?? "Could not resign");
  }
}

export function subscribeToPrivateRoom(
  code: string,
  callback: (room: PrivateRoom | null) => void
): () => void {
  return onSnapshot(doc(getFirebaseDb(), "privateRooms", code.toUpperCase()), (snap) => {
    if (!snap.exists()) {
      callback(null);
      return;
    }
    callback(snap.data() as PrivateRoom);
  });
}
