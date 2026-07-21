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
  ChessGameType,
  MatchMode,
  MatchPlayer,
  MatchmakingEntry,
  MatchmakingMember,
  PartyDocument,
  PrivateRoom,
  UserProfile,
} from "@/types/firestore";
import {
  assignPlayersToBoards,
  assignTwoPlayersToSingleBoard,
  createInitialBoardsForGameType,
} from "./board-state";
import { createSetupEndsTimestamp } from "./match-setup-service";
import {
  assignPlayersFromUnits,
  assignTwoPlayersFromUnits,
  averageRating,
  findQueueCombo,
} from "./team-builder";
import {
  getRatingForGameType,
  isSoloGameType,
  normalizeGameType,
  playersNeeded,
  allowedMatchModes,
} from "./game-types";
import {
  BOT_BACKFILL_RETRY_MS,
  BOT_QUEUE_TIMEOUT_MS,
  buildBotFillUnits,
  isBotUid,
  pickBots,
} from "./bots";
import {
  filterQueueByTimeControl,
  RANKED_TIME_CONTROL_SEC,
  resolveQueueTimeControl,
  STANDARD_TIME_CONTROL_SEC,
} from "./time-control";
import { resolveQueueMembers } from "./queue-members";

export { resolveQueueMembers };

export { BOT_QUEUE_TIMEOUT_MS, BOT_BACKFILL_RETRY_MS };

/** When exactly two humans are waiting, fill bots after this grace period. */
export const HUMAN_PAIR_BOT_GRACE_MS = 5_000;

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

/** True when two humans queued as party / same queue entry (should share a team). */
export function areQueueHumansTeammates(
  selected: MatchmakingEntry[],
  humans: MatchmakingMember[]
): boolean {
  if (humans.length !== 2) return false;
  const humanUids = new Set(humans.map((h) => h.uid));

  for (const entry of selected) {
    const inEntry = entry.members.filter((m) => humanUids.has(m.uid)).length;
    if (inEntry === 2) return true;
  }

  const partyIds = selected
    .filter((e) => e.partyId && e.members.some((m) => humanUids.has(m.uid)))
    .map((e) => e.partyId as string);
  return partyIds.length >= 2 && partyIds.every((id) => id === partyIds[0]);
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
    gameType: normalizeGameType(data.gameType),
    rating: (data.rating as number) ?? averageRating(members),
    timestamp: data.timestamp as MatchmakingEntry["timestamp"],
    partyId: (data.partyId as string | null | undefined) ?? null,
    memberUids: (data.memberUids as string[] | undefined) ?? members.map((m) => m.uid),
    members,
    timeControl: (data.timeControl as number | undefined) ?? undefined,
    stakePerPlayer: (data.stakePerPlayer as number | undefined) ?? undefined,
  };
}

export async function clearUserQueueEntries(uid: string): Promise<void> {
  const db = getFirebaseDb();
  const snap = await getDocs(
    query(
      collection(db, "matchmaking"),
      where("memberUids", "array-contains", uid)
    )
  );
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
}

export async function joinQueue(
  user: UserProfile,
  mode: MatchMode,
  party?: PartyDocument | null,
  timeControlSec?: number,
  stakePerPlayer?: number,
  gameType: ChessGameType = "bughouse"
): Promise<string> {
  await clearUserQueueEntries(user.uid);

  try {
    const { clearTournamentRegistrationOnGameStart } = await import(
      "@/lib/wallet/wallet-api"
    );
    await clearTournamentRegistrationOnGameStart();
  } catch {
    /* best-effort — don't block queue */
  }

  const type = normalizeGameType(gameType);

  if (!allowedMatchModes(type).includes(mode)) {
    throw new Error(
      mode === "ranked"
        ? "Ranked is only available for Bughouse."
        : "This match mode is not available for the selected game."
    );
  }

  if (isSoloGameType(type)) {
    if (party && party.members.length > 1) {
      throw new Error("This mode is solo only — leave your party first.");
    }
  }

  const members = resolveQueueMembers(user, party, type);

  if (party && party.leaderUid !== user.uid && !isSoloGameType(type)) {
    throw new Error("Only the party leader can queue for matchmaking");
  }

  const timeControl =
    mode === "ranked"
      ? RANKED_TIME_CONTROL_SEC
      : (timeControlSec ?? STANDARD_TIME_CONTROL_SEC);

  const ref = await addDoc(collection(getFirebaseDb(), "matchmaking"), {
    uid: user.uid,
    displayName: user.displayName,
    mode,
    gameType: type,
    rating: averageRating(members),
    timestamp: serverTimestamp(),
    partyId: isSoloGameType(type) ? null : party?.id ?? null,
    memberUids: members.map((m) => m.uid),
    members,
    timeControl,
    ...(stakePerPlayer ? { stakePerPlayer } : {}),
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
    },
    (error) => {
      console.error("[matchmaking] subscribeToActiveMatch failed", error);
    }
  );
}

export function subscribeToQueue(
  uid: string,
  mode: MatchMode,
  queueEntryId: string,
  onFound: (matchId: string, options?: { usedBots?: boolean }) => void,
  onBotBackfillFailed?: (error?: unknown) => void,
  onQueueStats?: (stats: { liveHumans: number }) => void,
  gameType: ChessGameType = "bughouse"
): () => void {
  const type = normalizeGameType(gameType);
  const needSlots = playersNeeded(type);

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
    if (mode === "stake") return;
    if (settled || creating) return;
    creating = true;
    void tryCreateBotMatch(queueEntryId, mode, type)
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

    const entries = snap.docs
      .map((d) => normalizeQueueEntry(d.id, d.data()))
      .filter((e) => normalizeGameType(e.gameType) === type);
    const myEntry = entries.find((e) => e.id === queueEntryId);
    let pool = myEntry ? filterQueueByTimeControl(entries, myEntry) : entries;
    if (mode === "stake" && myEntry?.stakePerPlayer != null) {
      pool = pool.filter((e) => e.stakePerPlayer === myEntry.stakePerPlayer);
    }
    onQueueStats?.({ liveHumans: countLiveHumansInQueue(pool) });
    const liveHumans = countLiveHumansInQueue(pool);

    const combo = myEntry
      ? findQueueCombo(pool, queueEntryId, needSlots)
      : null;
    if (combo) {
      creating = true;
      try {
        const matchId = await createMatchFromQueue(combo, mode, type);
        if (matchId) finish(matchId, false);
      } finally {
        creating = false;
      }
      return;
    }

    const botFillReadyMs =
      liveHumans === Math.max(1, needSlots - 1) && needSlots === 4
        ? HUMAN_PAIR_BOT_GRACE_MS
        : BOT_QUEUE_TIMEOUT_MS;

    if (myEntry && entryWaitMs(myEntry) >= botFillReadyMs) {
      attemptBotBackfill(
        liveHumans === needSlots - 1 ? "human-pair" : "timeout"
      );
      return;
    }

    if (!myEntry && entryWaitMs(undefined) >= botFillReadyMs) {
      attemptBotBackfill("entry-missing");
    }
  });

  const botTimer = window.setTimeout(() => {
    if (mode !== "stake") attemptBotBackfill("timer");
  }, Math.max(0, BOT_QUEUE_TIMEOUT_MS - (Date.now() - joinedAtMs)));

  const botRetry = window.setInterval(() => {
    if (mode === "stake") return;
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
  mode: MatchMode,
  gameType: ChessGameType = "bughouse"
): Promise<string | null> {
  return tryCreateBotMatchBatch(queueEntryId, mode, gameType);
}

/** Greedily bundle queue entries (starting with the anchor) up to needSlots. */
function collectQueueEntriesForBotFill(
  entries: MatchmakingEntry[],
  anchorId: string,
  needSlots: number
): MatchmakingEntry[] {
  const anchor = entries.find((e) => e.id === anchorId);
  if (!anchor) return [];

  const pool = filterQueueByTimeControl(entries, anchor);
  const sorted = [...pool].sort((a, b) => {
    const ta = a.timestamp?.toMillis?.() ?? 0;
    const tb = b.timestamp?.toMillis?.() ?? 0;
    return ta - tb;
  });

  const selected: MatchmakingEntry[] = [anchor];
  let slots = anchor.members.length;

  for (const entry of sorted) {
    if (entry.id === anchorId) continue;
    if (slots + entry.members.length > needSlots) continue;

    const selectedUids = new Set(selected.flatMap((e) => e.memberUids));
    const sharesMember = entry.memberUids.some((uid) => selectedUids.has(uid));
    if (sharesMember) continue;

    selected.push(entry);
    slots += entry.members.length;
    if (slots >= needSlots) break;
  }

  return selected;
}

async function tryCreateBotMatchBatch(
  queueEntryId: string,
  mode: MatchMode,
  gameType: ChessGameType = "bughouse"
): Promise<string | null> {
  const type = normalizeGameType(gameType);
  const needSlots = playersNeeded(type);
  const db = getFirebaseDb();
  const entryRef = doc(db, "matchmaking", queueEntryId);
  const entrySnap = await getDoc(entryRef);
  if (!entrySnap.exists()) return null;

  const queueSnap = await getDocs(
    query(collection(db, "matchmaking"), where("mode", "==", mode), limit(50))
  );
  const entries = queueSnap.docs
    .map((d) => normalizeQueueEntry(d.id, d.data() as Record<string, unknown>))
    .filter((e) => normalizeGameType(e.gameType) === type);

  const anchorEntry = entries.find((e) => e.id === queueEntryId);
  if (!anchorEntry) return null;
  const pool = filterQueueByTimeControl(entries, anchorEntry);

  const selected = collectQueueEntriesForBotFill(pool, queueEntryId, needSlots);
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
  if (totalSlots >= needSlots) return null;

  const slotsNeeded = needSlots - totalSlots;
  if (slotsNeeded <= 0) return null;

  const bots = pickBots(slotsNeeded, humans);
  const teammates =
    needSlots === 4 ? areQueueHumansTeammates(selected, humans) : false;
  const units = buildBotFillUnits(humans, bots, {
    teammates,
    totalSlots: needSlots,
  });
  const players: MatchPlayer[] =
    needSlots === 2
      ? (assignTwoPlayersFromUnits(units) as MatchPlayer[])
      : assignPlayersFromUnits(units);
  const queueEntryIds = selected.map((e) => e.id);

  try {
    return await runTransaction(db, async (transaction) => {
      for (const entry of selected) {
        const snap = await transaction.get(doc(db, "matchmaking", entry.id));
        if (!snap.exists()) return null;
      }

      return persistMatchInTransaction(transaction, db, {
        mode,
        gameType: type,
        players,
        queueEntryIds,
        timeControlSec: resolveQueueTimeControl(
          selected[0] ?? { mode, timeControl: STANDARD_TIME_CONTROL_SEC }
        ),
      });
    });
  } catch (error) {
    console.warn("[matchmaking] bot match transaction failed", error);
    return null;
  }
}

async function createMatchFromQueue(
  entries: MatchmakingEntry[],
  mode: MatchMode,
  gameType: ChessGameType = "bughouse"
): Promise<string | null> {
  const type = normalizeGameType(gameType);
  const needSlots = playersNeeded(type);
  const db = getFirebaseDb();
  const units = entries.map((e) => e.members);
  const players: MatchPlayer[] =
    needSlots === 2
      ? (assignTwoPlayersFromUnits(units) as MatchPlayer[])
      : assignPlayersFromUnits(units);

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
        gameType: type,
        players,
        queueEntryIds: entries.map((e) => e.id),
        timeControlSec: resolveQueueTimeControl(entries[0]!),
        stakePerPlayer: entries[0]?.stakePerPlayer,
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
    gameType?: ChessGameType;
    players: MatchPlayer[];
    queueEntryIds: string[];
    timeControlSec: number;
    stakePerPlayer?: number;
  }
): string {
  const {
    mode,
    players,
    queueEntryIds,
    timeControlSec,
    stakePerPlayer,
  } = opts;
  const gameType = normalizeGameType(opts.gameType);
  const humanUids = players.filter((p) => !p.isBot).map((p) => p.uid);
  const botUids = players.filter((p) => p.isBot).map((p) => p.uid);

  const matchRef = doc(collection(db, "matches"));
  transaction.set(matchRef, {
    mode,
    gameType,
    status: "setup",
    players: players.map(serializeMatchPlayer),
    playerUids: humanUids,
    botUids,
    hasBots: botUids.length > 0,
    colorChoices: {},
    setupEndsAt: createSetupEndsTimestamp(),
    teamClocks: { team1: timeControlSec, team2: timeControlSec },
    timeControl: timeControlSec,
    winnerTeam: null,
    createdAt: serverTimestamp(),
    startedAt: null,
    completedAt: null,
    ...(stakePerPlayer ? { stakePerPlayer } : {}),
  });

  for (const board of createInitialBoardsForGameType(
    players,
    gameType,
    timeControlSec
  )) {
    transaction.set(doc(matchRef, "boards", board.id), serializeBoard(board));
  }

  for (const entryId of queueEntryIds) {
    transaction.delete(doc(db, "matchmaking", entryId));
  }

  for (const uid of humanUids) {
    transaction.set(doc(db, "users", uid, "session", "active"), {
      matchId: matchRef.id,
      mode,
      gameType,
      createdAt: serverTimestamp(),
    });
  }

  return matchRef.id;
}

export async function createPrivateRoom(
  host: UserProfile,
  mode: MatchMode = "private",
  gameType: ChessGameType = "bughouse"
): Promise<string> {
  const type = normalizeGameType(gameType);
  const code = Math.random().toString(36).slice(2, 8).toUpperCase();
  await setDoc(doc(getFirebaseDb(), "privateRooms", code), {
    code,
    hostId: host.uid,
    hostDisplayName: host.displayName,
    settings: {
      mode,
      timeControl: STANDARD_TIME_CONTROL_SEC,
      gameType: type,
    },
    players: [
      {
        uid: host.uid,
        displayName: host.displayName,
        photoURL: host.photoURL,
        boardId: "",
        team: 1,
        rating: getRatingForGameType(host, type),
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

  const type = normalizeGameType(room.settings.gameType);
  const need = playersNeeded(type);

  const players = [
    ...room.players,
    {
      uid: user.uid,
      displayName: user.displayName,
      photoURL: user.photoURL,
      boardId: "",
      team: 1 as const,
      rating: getRatingForGameType(user, type),
    },
  ];

  await updateDoc(roomRef, { players });

  if (players.length === need) {
    const matchId = await startPrivateMatch(
      code,
      players,
      room.settings.mode,
      type
    );
    await updateDoc(roomRef, { status: "started", matchId });
  }

  return { ...room, players };
}

async function startPrivateMatch(
  code: string,
  players: MatchPlayer[],
  mode: MatchMode,
  gameType: ChessGameType = "bughouse"
): Promise<string> {
  const type = normalizeGameType(gameType);
  const assigned =
    type === "bughouse"
      ? assignPlayersToBoards(players)
      : assignTwoPlayersToSingleBoard(players);
  const matchRef = doc(collection(getFirebaseDb(), "matches"));
  const batch = writeBatch(getFirebaseDb());

  batch.set(matchRef, {
    mode,
    gameType: type,
    status: "setup",
    players: assigned.map(serializeMatchPlayer),
    playerUids: assigned.filter((p) => !p.isBot).map((p) => p.uid),
    botUids: assigned.filter((p) => p.isBot).map((p) => p.uid),
    hasBots: assigned.some((p) => p.isBot),
    colorChoices: {},
    setupEndsAt: createSetupEndsTimestamp(),
    teamClocks: {
      team1: STANDARD_TIME_CONTROL_SEC,
      team2: STANDARD_TIME_CONTROL_SEC,
    },
    timeControl: STANDARD_TIME_CONTROL_SEC,
    winnerTeam: null,
    privateRoomCode: code,
    createdAt: serverTimestamp(),
    startedAt: null,
    completedAt: null,
  });

  for (const board of createInitialBoardsForGameType(
    assigned,
    type,
    STANDARD_TIME_CONTROL_SEC
  )) {
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
