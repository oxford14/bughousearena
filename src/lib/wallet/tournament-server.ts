import { createHash, randomBytes } from "node:crypto";
import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { debitCoins, creditCoins, WalletError } from "@/lib/wallet/wallet-server";
import type { TournamentBracketMatch, TournamentVisibility } from "@/types/wallet";
import {
  buildPlayersFromTeams,
  createMatchAdmin,
} from "@/lib/game/match-create-admin";
import { isUserAdmin } from "@/lib/server/verify-admin";
import { resolveOnlineStatus } from "@/lib/social/presence";
import {
  TOURNAMENT_DISCONNECT_FORFEIT_MS,
  TOURNAMENT_ENTRY_FEE,
  TOURNAMENT_MAX_PLAYERS,
  TOURNAMENT_MAX_TEAMS,
  TOURNAMENT_PAYOUT_RATE,
  TOURNAMENT_REGISTRATION_OFFLINE_MS,
} from "@/lib/wallet/tournament-constants";

export {
  TOURNAMENT_DISCONNECT_FORFEIT_MS,
  TOURNAMENT_ENTRY_FEE,
  TOURNAMENT_MAX_PLAYERS,
  TOURNAMENT_MAX_TEAMS,
  TOURNAMENT_PAYOUT_RATE,
  TOURNAMENT_REGISTRATION_OFFLINE_MS,
} from "@/lib/wallet/tournament-constants";

export function hashTournamentPin(pin: string, roomCode: string): string {
  return createHash("sha256").update(`${roomCode}:${pin}`).digest("hex");
}

export function verifyTournamentPin(
  pin: string,
  roomCode: string,
  pinHash: string | null | undefined
): boolean {
  if (!pinHash) return false;
  return hashTournamentPin(pin, roomCode) === pinHash;
}

function generateRoomCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(6);
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += alphabet[bytes[i]! % alphabet.length]!;
  }
  return code;
}

function shuffleInPlace<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j]!, items[i]!];
  }
  return items;
}

function championPayoutFromPool(prizePoolCoins: number): number {
  return Math.floor(prizePoolCoins * TOURNAMENT_PAYOUT_RATE);
}

async function ensureUniqueRoomCode(db: Firestore): Promise<string> {
  for (let attempt = 0; attempt < 12; attempt++) {
    const code = generateRoomCode();
    const existing = await db
      .collection("tournaments")
      .where("roomCode", "==", code)
      .limit(1)
      .get();
    if (existing.empty) return code;
  }
  return `${generateRoomCode()}${Date.now().toString(36).slice(-2).toUpperCase()}`;
}

export async function assertHostOrAdmin(
  db: Firestore,
  tournamentHostUid: string,
  callerUid: string
): Promise<void> {
  if (tournamentHostUid === callerUid) return;
  if (await isUserAdmin(callerUid)) return;
  throw new Error("Only the host can do that.");
}

function emptySlots(): (string | null)[] {
  return Array.from({ length: TOURNAMENT_MAX_PLAYERS }, () => null);
}

/** Normalize or backfill slots for legacy rooms missing the array. */
function normalizeSlots(
  slots: unknown,
  memberUids: string[],
  maxPlayers: number = TOURNAMENT_MAX_PLAYERS
): (string | null)[] {
  if (Array.isArray(slots) && slots.length === maxPlayers) {
    return slots.map((s) => (typeof s === "string" && s ? s : null));
  }
  const result = Array.from({ length: maxPlayers }, () => null as string | null);
  for (let i = 0; i < memberUids.length && i < maxPlayers; i++) {
    result[i] = memberUids[i]!;
  }
  return result;
}

async function addMemberDoc(
  db: Firestore,
  tournamentId: string,
  member: {
    uid: string;
    displayName: string;
    photoURL: string | null;
    joinOrder: number;
    slotIndex: number;
  }
): Promise<void> {
  await db
    .collection("tournaments")
    .doc(tournamentId)
    .collection("members")
    .doc(member.uid)
    .set({
      uid: member.uid,
      displayName: member.displayName,
      photoURL: member.photoURL,
      joinOrder: member.joinOrder,
      slotIndex: member.slotIndex,
      joinedAt: FieldValue.serverTimestamp(),
    });
}

/** Create room and auto-enter the host. */
export async function createTournament(
  db: Firestore,
  input: {
    name: string;
    description?: string;
    hostUid: string;
    hostDisplayName: string;
    hostPhotoURL?: string | null;
    visibility: TournamentVisibility;
    pin?: string;
  }
): Promise<{ tournamentId: string; roomCode: string }> {
  if (input.visibility === "private") {
    if (!input.pin || !/^\d{4}$/.test(input.pin)) {
      throw new Error("Private tournaments require a 4-digit PIN.");
    }
  }

  const hostSnap = await db.collection("users").doc(input.hostUid).get();
  const coins = (hostSnap.data()?.arenaCoins as number) ?? 0;
  if (coins < TOURNAMENT_ENTRY_FEE) {
    throw new Error(
      `You need at least ${TOURNAMENT_ENTRY_FEE} coins to host a tournament.`
    );
  }

  const roomCode = await ensureUniqueRoomCode(db);
  const ref = db.collection("tournaments").doc();
  const slots = emptySlots();
  slots[0] = input.hostUid;

  await ref.set({
    name: input.name.trim(),
    description: input.description?.trim() ?? "",
    hostUid: input.hostUid,
    hostDisplayName: input.hostDisplayName,
    visibility: input.visibility,
    roomCode,
    pinHash:
      input.visibility === "private" && input.pin
        ? hashTournamentPin(input.pin, roomCode)
        : null,
    registrationFeeCoins: TOURNAMENT_ENTRY_FEE,
    maxTeams: TOURNAMENT_MAX_TEAMS,
    maxPlayers: TOURNAMENT_MAX_PLAYERS,
    playerCount: 1,
    memberUids: [input.hostUid],
    slots,
    registeredTeamCount: 0,
    prizePoolCoins: 0,
    championRewardCoins: 0,
    status: "registration",
    currentRound: 0,
    createdAt: FieldValue.serverTimestamp(),
    bracket: [],
    championTeamId: null,
    runnerUpTeamId: null,
  });

  await addMemberDoc(db, ref.id, {
    uid: input.hostUid,
    displayName: input.hostDisplayName,
    photoURL: input.hostPhotoURL ?? (hostSnap.data()?.photoURL as string | null) ?? null,
    joinOrder: 0,
    slotIndex: 0,
  });

  return { tournamentId: ref.id, roomCode };
}

/** Join lobby into a chosen slot, or move if already in the room. */
export async function joinTournamentRoom(
  db: Firestore,
  tournamentId: string,
  uid: string,
  pin?: string,
  slotIndex?: number
): Promise<{ joined: boolean; slotIndex: number; moved?: boolean }> {
  if (
    typeof slotIndex !== "number" ||
    !Number.isInteger(slotIndex) ||
    slotIndex < 0 ||
    slotIndex >= TOURNAMENT_MAX_PLAYERS
  ) {
    throw new Error("Pick a valid empty slot (1–16).");
  }

  const tournamentRef = db.collection("tournaments").doc(tournamentId);
  const preSnap = await tournamentRef.get();
  if (!preSnap.exists) throw new Error("Tournament not found.");
  const preMemberUids = [...((preSnap.data()!.memberUids as string[]) ?? [])];
  const alreadyMember = preMemberUids.includes(uid);

  let displayName = "Player";
  let photoURL: string | null = null;

  if (!alreadyMember) {
    const userSnap = await db.collection("users").doc(uid).get();
    if (!userSnap.exists) throw new Error("Player profile not found.");
    const coins = (userSnap.data()?.arenaCoins as number) ?? 0;
    if (coins < TOURNAMENT_ENTRY_FEE) {
      throw new Error(
        `You need at least ${TOURNAMENT_ENTRY_FEE} coins to join.`
      );
    }
    displayName = (userSnap.data()!.displayName as string) ?? "Player";
    photoURL = (userSnap.data()!.photoURL as string | null) ?? null;
  } else {
    const userSnap = await db.collection("users").doc(uid).get();
    if (userSnap.exists) {
      displayName = (userSnap.data()!.displayName as string) ?? "Player";
      photoURL = (userSnap.data()!.photoURL as string | null) ?? null;
    }
  }

  const result = await db.runTransaction(async (tx) => {
    const tournamentSnap = await tx.get(tournamentRef);
    if (!tournamentSnap.exists) throw new Error("Tournament not found.");

    const tournament = tournamentSnap.data()!;
    if (tournament.status !== "registration") {
      throw new Error("This room is closed.");
    }

    if (tournament.visibility === "private") {
      if (
        !verifyTournamentPin(
          pin ?? "",
          tournament.roomCode as string,
          tournament.pinHash as string | null
        )
      ) {
        throw new Error("Incorrect PIN.");
      }
    }

    const memberUids = [...((tournament.memberUids as string[]) ?? [])];
    const maxPlayers =
      (tournament.maxPlayers as number) ?? TOURNAMENT_MAX_PLAYERS;
    const slots = normalizeSlots(tournament.slots, memberUids, maxPlayers);

    if (memberUids.includes(uid)) {
      const existingMember = await tx.get(
        tournamentRef.collection("members").doc(uid)
      );
      let oldSlot =
        (existingMember.data()?.slotIndex as number | undefined) ??
        slots.indexOf(uid);
      if (oldSlot < 0) {
        oldSlot = slots.findIndex((s) => s === uid);
      }

      if (oldSlot === slotIndex) {
        return { slotIndex, moved: false };
      }

      const occupant = slots[slotIndex];
      if (occupant && occupant !== uid) {
        throw new Error("That slot is already taken.");
      }

      for (let i = 0; i < slots.length; i++) {
        if (slots[i] === uid) slots[i] = null;
      }
      slots[slotIndex] = uid;

      tx.update(tournamentRef, { slots });

      if (existingMember.exists) {
        tx.update(tournamentRef.collection("members").doc(uid), { slotIndex });
      } else {
        tx.set(tournamentRef.collection("members").doc(uid), {
          uid,
          displayName,
          photoURL,
          joinOrder: memberUids.indexOf(uid),
          slotIndex,
          joinedAt: FieldValue.serverTimestamp(),
        });
      }

      return { slotIndex, moved: true };
    }

    if (memberUids.length >= maxPlayers) {
      throw new Error("Room is full.");
    }

    if (slots[slotIndex]) {
      throw new Error("That slot is already taken.");
    }

    const joinOrder = memberUids.length;
    memberUids.push(uid);
    slots[slotIndex] = uid;

    tx.update(tournamentRef, {
      memberUids,
      playerCount: memberUids.length,
      slots,
    });

    tx.set(tournamentRef.collection("members").doc(uid), {
      uid,
      displayName,
      photoURL,
      joinOrder,
      slotIndex,
      joinedAt: FieldValue.serverTimestamp(),
    });

    return { slotIndex, moved: false };
  });

  return {
    joined: true,
    slotIndex: result.slotIndex,
    ...(result.moved ? { moved: true } : {}),
  };
}

/**
 * Leave the room. Host succession goes to the next join-order member.
 * Empty room is cancelled/closed.
 */
export async function leaveTournamentRoom(
  db: Firestore,
  tournamentId: string,
  uid: string
): Promise<{ left: boolean; closed: boolean; newHostUid?: string }> {
  const tournamentRef = db.collection("tournaments").doc(tournamentId);
  const tournamentSnap = await tournamentRef.get();
  if (!tournamentSnap.exists) return { left: false, closed: false };

  const tournament = tournamentSnap.data()!;
  if (tournament.status !== "registration") {
    return { left: false, closed: false };
  }

  let memberUids = [...((tournament.memberUids as string[]) ?? [])];
  if (!memberUids.includes(uid)) {
    return { left: false, closed: false };
  }

  const maxPlayers =
    (tournament.maxPlayers as number) ?? TOURNAMENT_MAX_PLAYERS;
  const slots = normalizeSlots(tournament.slots, memberUids, maxPlayers);

  const memberSnap = await tournamentRef.collection("members").doc(uid).get();
  let slotIndex = memberSnap.data()?.slotIndex as number | undefined;
  if (typeof slotIndex !== "number" || slotIndex < 0 || slotIndex >= maxPlayers) {
    slotIndex = slots.indexOf(uid);
  }
  if (slotIndex >= 0) {
    slots[slotIndex] = null;
  }

  memberUids = memberUids.filter((id) => id !== uid);
  await tournamentRef.collection("members").doc(uid).delete();

  if (memberUids.length === 0) {
    await tournamentRef.update({
      memberUids: [],
      playerCount: 0,
      slots: emptySlots(),
      status: "cancelled",
      hostUid: "",
      hostDisplayName: "",
    });
    return { left: true, closed: true };
  }

  const updates: Record<string, unknown> = {
    memberUids,
    playerCount: memberUids.length,
    slots,
  };

  let newHostUid: string | undefined;
  if (tournament.hostUid === uid) {
    newHostUid = memberUids[0]!;
    const hostMember = await tournamentRef
      .collection("members")
      .doc(newHostUid)
      .get();
    updates.hostUid = newHostUid;
    updates.hostDisplayName =
      (hostMember.data()?.displayName as string) ?? "Host";
  }

  await tournamentRef.update(updates);
  return { left: true, closed: false, newHostUid };
}

export async function kickTournamentMember(
  db: Firestore,
  tournamentId: string,
  targetUid: string,
  callerUid: string
): Promise<void> {
  const tournamentSnap = await db
    .collection("tournaments")
    .doc(tournamentId)
    .get();
  if (!tournamentSnap.exists) throw new Error("Tournament not found.");
  const tournament = tournamentSnap.data()!;
  await assertHostOrAdmin(db, tournament.hostUid as string, callerUid);

  if (targetUid === tournament.hostUid) {
    throw new Error("Host cannot kick themselves — leave the room instead.");
  }

  const result = await leaveTournamentRoom(db, tournamentId, targetUid);
  if (!result.left) throw new Error("Player is not in this room.");
}

/** @deprecated Use leaveTournamentRoom */
export async function leaveTournamentAsPlayer(
  db: Firestore,
  tournamentId: string,
  uid: string
): Promise<boolean> {
  const result = await leaveTournamentRoom(db, tournamentId, uid);
  return result.left;
}

function userLooksOffline(
  data: Record<string, unknown> | undefined
): boolean {
  if (!data) return true;
  const rawLast = data.lastOnline as { toDate?: () => Date } | undefined;
  const lastOnline = rawLast?.toDate?.() as Date | undefined;
  const status = resolveOnlineStatus(data.onlineStatus, lastOnline);
  if (status === "offline") return true;
  if (!lastOnline) return true;
  return Date.now() - lastOnline.getTime() > TOURNAMENT_REGISTRATION_OFFLINE_MS;
}

export async function pruneTournamentRegistration(
  db: Firestore,
  tournamentId: string
): Promise<{ removed: number }> {
  const tournamentRef = db.collection("tournaments").doc(tournamentId);
  const tournamentSnap = await tournamentRef.get();
  if (!tournamentSnap.exists) return { removed: 0 };
  if (tournamentSnap.data()!.status !== "registration") return { removed: 0 };

  const memberUids = [
    ...((tournamentSnap.data()!.memberUids as string[]) ?? []),
  ];
  let removed = 0;

  for (const uid of [...memberUids]) {
    const userSnap = await db.collection("users").doc(uid).get();
    const offline = userLooksOffline(
      userSnap.data() as Record<string, unknown> | undefined
    );

    let inOtherGame = false;
    const sessionSnap = await db
      .collection("users")
      .doc(uid)
      .collection("session")
      .doc("active")
      .get();
    if (sessionSnap.exists) {
      const matchId = sessionSnap.data()?.matchId as string | undefined;
      if (matchId) {
        const matchSnap = await db.collection("matches").doc(matchId).get();
        if (matchSnap.exists) {
          const match = matchSnap.data()!;
          if (
            match.status !== "completed" &&
            match.status !== "abandoned" &&
            match.tournamentId !== tournamentId
          ) {
            inOtherGame = true;
          }
        }
      }
    }

    if (offline || inOtherGame) {
      await leaveTournamentRoom(db, tournamentId, uid);
      removed += 1;
    }
  }

  return { removed };
}

export async function removePlayerFromOpenTournaments(
  db: Firestore,
  uid: string
): Promise<number> {
  const open = await db
    .collection("tournaments")
    .where("status", "==", "registration")
    .get();

  let count = 0;
  for (const tDoc of open.docs) {
    const memberUids = (tDoc.data().memberUids as string[]) ?? [];
    if (!memberUids.includes(uid)) continue;
    const left = await leaveTournamentRoom(db, tDoc.id, uid);
    if (left.left) count += 1;
  }
  return count;
}

export function buildSingleEliminationBracket(
  teamIds: string[]
): TournamentBracketMatch[] {
  if (teamIds.length !== TOURNAMENT_MAX_TEAMS) {
    throw new Error("Bracket requires exactly 8 teams.");
  }
  const matches: TournamentBracketMatch[] = [];

  for (let i = 0; i < 4; i++) {
    matches.push({
      id: `r1_m${i}`,
      round: 1,
      matchIndex: i,
      team1Id: teamIds[i * 2]!,
      team2Id: teamIds[i * 2 + 1]!,
      matchId: null,
      winnerTeamId: null,
    });
  }
  for (let i = 0; i < 2; i++) {
    matches.push({
      id: `r2_m${i}`,
      round: 2,
      matchIndex: i,
      team1Id: null,
      team2Id: null,
      matchId: null,
      winnerTeamId: null,
    });
  }
  matches.push({
    id: "r3_m0",
    round: 3,
    matchIndex: 0,
    team1Id: null,
    team2Id: null,
    matchId: null,
    winnerTeamId: null,
  });

  return matches;
}

/** Debit all members, pair adjacent slots into 8 teams, build bracket. */
export async function startTournamentBracket(
  db: Firestore,
  tournamentId: string,
  callerUid: string
): Promise<void> {
  const tournamentRef = db.collection("tournaments").doc(tournamentId);
  const tournamentSnap = await tournamentRef.get();
  if (!tournamentSnap.exists) throw new Error("Tournament not found.");

  const tournament = tournamentSnap.data()!;
  await assertHostOrAdmin(db, tournament.hostUid as string, callerUid);

  if (tournament.status !== "registration") {
    throw new Error("Tournament is not in registration.");
  }

  const memberUids = [...((tournament.memberUids as string[]) ?? [])];
  const maxPlayers =
    (tournament.maxPlayers as number) ?? TOURNAMENT_MAX_PLAYERS;
  const slots = normalizeSlots(tournament.slots, memberUids, maxPlayers);

  if (memberUids.length !== maxPlayers || slots.some((s) => !s)) {
    throw new Error(
      `Need all ${maxPlayers} slots filled to start (currently ${memberUids.length}).`
    );
  }

  const fee =
    (tournament.registrationFeeCoins as number) ?? TOURNAMENT_ENTRY_FEE;
  const membersSnap = await tournamentRef.collection("members").get();
  const membersByUid = new Map(
    membersSnap.docs.map((d) => [d.id, d.data()] as const)
  );

  for (const uid of memberUids) {
    try {
      await debitCoins(db, {
        uid,
        amount: -fee,
        type: "tournament_fee",
        refId: `${tournamentId}_entry_${uid}`,
        metadata: { tournamentId },
      });
    } catch (error) {
      if (error instanceof WalletError) {
        throw new Error(
          "A player no longer has enough coins. Kick them or wait for them to leave."
        );
      }
      throw error;
    }
  }

  const teamIds: string[] = [];

  for (let i = 0; i < TOURNAMENT_MAX_TEAMS; i++) {
    const p1 = slots[i * 2]!;
    const p2 = slots[i * 2 + 1]!;
    const m1 = membersByUid.get(p1);
    const m2 = membersByUid.get(p2);
    const teamRef = tournamentRef.collection("teams").doc();
    await teamRef.set({
      tournamentId,
      teamName: `Team ${i + 1}`,
      player1Uid: p1,
      player2Uid: p2,
      player1DisplayName: (m1?.displayName as string) ?? "Player",
      player2DisplayName: (m2?.displayName as string) ?? "Player",
      slotIndex: i,
      registeredAt: FieldValue.serverTimestamp(),
    });
    teamIds.push(teamRef.id);
  }

  const prizePool = fee * memberUids.length;
  const bracket = buildSingleEliminationBracket(shuffleInPlace([...teamIds]));

  await tournamentRef.update({
    status: "active",
    bracket,
    currentRound: 1,
    registeredTeamCount: TOURNAMENT_MAX_TEAMS,
    prizePoolCoins: prizePool,
    championRewardCoins: championPayoutFromPool(prizePool),
  });
}

function roundFullyComplete(
  bracket: TournamentBracketMatch[],
  round: number
): boolean {
  const roundMatches = bracket.filter((m) => m.round === round);
  return (
    roundMatches.length > 0 && roundMatches.every((m) => Boolean(m.winnerTeamId))
  );
}

export async function advanceTournamentOnMatchComplete(
  db: Firestore,
  tournamentId: string,
  matchId: string,
  winnerTeamId: string
): Promise<void> {
  const tournamentRef = db.collection("tournaments").doc(tournamentId);
  const tournamentSnap = await tournamentRef.get();
  if (!tournamentSnap.exists) return;

  const tournament = tournamentSnap.data()!;
  const bracket = (tournament.bracket as TournamentBracketMatch[]) ?? [];
  let bracketIndex = bracket.findIndex((m) => m.matchId === matchId);
  if (bracketIndex < 0 && matchId.startsWith("walkover_")) {
    const slotId = matchId.replace("walkover_", "");
    bracketIndex = bracket.findIndex((m) => m.id === slotId);
  }
  if (bracketIndex < 0) return;

  if (bracket[bracketIndex]!.winnerTeamId) return;

  await applyBracketWinner(db, tournamentId, bracket, bracketIndex, winnerTeamId);
}

async function applyBracketWinner(
  db: Firestore,
  tournamentId: string,
  bracket: TournamentBracketMatch[],
  bracketIndex: number,
  winnerTeamId: string
): Promise<void> {
  const tournamentRef = db.collection("tournaments").doc(tournamentId);
  const updated = [...bracket];
  updated[bracketIndex] = { ...updated[bracketIndex]!, winnerTeamId };

  const current = updated[bracketIndex]!;
  const nextRound = current.round + 1;
  const nextMatchIndex = Math.floor(current.matchIndex / 2);
  const nextBracketIndex = updated.findIndex(
    (m) => m.round === nextRound && m.matchIndex === nextMatchIndex
  );

  if (nextBracketIndex >= 0) {
    const slot = current.matchIndex % 2 === 0 ? "team1Id" : "team2Id";
    updated[nextBracketIndex] = {
      ...updated[nextBracketIndex]!,
      [slot]: winnerTeamId,
    };
  }

  const isFinal = current.round === 3;
  if (isFinal) {
    const loserTeamId =
      current.team1Id === winnerTeamId ? current.team2Id : current.team1Id;
    await tournamentRef.update({
      bracket: updated,
      status: "completed",
      championTeamId: winnerTeamId,
      runnerUpTeamId: loserTeamId,
    });
    await payTournamentRewards(db, tournamentId, winnerTeamId);
    return;
  }

  const roundDone = roundFullyComplete(updated, current.round);
  await tournamentRef.update({
    bracket: updated,
    ...(roundDone ? { currentRound: nextRound } : {}),
  });

  if (roundDone) {
    await spawnBracketMatches(db, tournamentId, nextRound);
  }
}

async function loadTeamMembers(
  db: Firestore,
  tournamentId: string,
  teamId: string
) {
  const teamSnap = await db
    .collection("tournaments")
    .doc(tournamentId)
    .collection("teams")
    .doc(teamId)
    .get();
  if (!teamSnap.exists) return null;

  const team = teamSnap.data()!;
  const [p1, p2] = await Promise.all([
    db.collection("users").doc(team.player1Uid as string).get(),
    db.collection("users").doc(team.player2Uid as string).get(),
  ]);

  return [
    {
      uid: team.player1Uid as string,
      displayName: (p1.data()?.displayName as string) ?? team.player1DisplayName,
      photoURL: (p1.data()?.photoURL as string | null) ?? null,
      rating: (p1.data()?.rating as number) ?? 1200,
    },
    {
      uid: team.player2Uid as string,
      displayName: (p2.data()?.displayName as string) ?? team.player2DisplayName,
      photoURL: (p2.data()?.photoURL as string | null) ?? null,
      rating: (p2.data()?.rating as number) ?? 1200,
    },
  ];
}

export async function spawnBracketMatches(
  db: Firestore,
  tournamentId: string,
  round: number
): Promise<void> {
  const tournamentRef = db.collection("tournaments").doc(tournamentId);
  const tournamentSnap = await tournamentRef.get();
  if (!tournamentSnap.exists) return;

  const data = tournamentSnap.data()!;
  if (round > 1) {
    const bracket = (data.bracket as TournamentBracketMatch[]) ?? [];
    if (!roundFullyComplete(bracket, round - 1)) return;
  }

  const bracket = (data.bracket as TournamentBracketMatch[]) ?? [];
  const roundMatches = bracket.filter((m) => m.round === round);
  const updated = [...bracket];
  let changed = false;
  const now = Date.now();

  for (const bracketMatch of roundMatches) {
    const index = updated.findIndex((m) => m.id === bracketMatch.id);
    if (index < 0 || updated[index]!.matchId || updated[index]!.winnerTeamId) {
      continue;
    }

    const team1Id = updated[index]!.team1Id;
    const team2Id = updated[index]!.team2Id;
    if (!team1Id || !team2Id) continue;

    const team1Members = await loadTeamMembers(db, tournamentId, team1Id);
    const team2Members = await loadTeamMembers(db, tournamentId, team2Id);
    if (!team1Members || !team2Members) continue;

    const players = buildPlayersFromTeams(team1Members, team2Members);
    const heartbeats: Record<string, number> = {};
    for (const p of players) {
      heartbeats[p.uid] = now;
    }

    const matchId = await createMatchAdmin(db, {
      mode: "private",
      players,
      tournamentId,
      tournamentBracketMatchId: bracketMatch.id,
      tournamentTeam1Id: team1Id,
      tournamentTeam2Id: team2Id,
    });

    await db.collection("matches").doc(matchId).update({
      tournamentHeartbeats: heartbeats,
    });

    updated[index] = { ...updated[index]!, matchId };
    changed = true;
  }

  if (changed) {
    await tournamentRef.update({ bracket: updated, currentRound: round });
  }
}

async function payTournamentRewards(
  db: Firestore,
  tournamentId: string,
  championTeamId: string
): Promise<void> {
  const tournamentRef = db.collection("tournaments").doc(tournamentId);
  const tournamentSnap = await tournamentRef.get();
  if (!tournamentSnap.exists) return;

  const data = tournamentSnap.data()!;
  const prizePool =
    (data.prizePoolCoins as number) ??
    (data.championRewardCoins as number) ??
    0;
  const payout = championPayoutFromPool(prizePool);
  if (payout <= 0) return;

  const championTeam = await tournamentRef
    .collection("teams")
    .doc(championTeamId)
    .get();
  if (!championTeam.exists) return;

  const ct = championTeam.data()!;
  const championUids = [ct.player1Uid, ct.player2Uid] as string[];
  const perChampion = Math.floor(payout / 2);
  const remainder = payout - perChampion * 2;

  for (let i = 0; i < championUids.length; i++) {
    const uid = championUids[i]!;
    const amount = perChampion + (i === 0 ? remainder : 0);
    if (amount <= 0) continue;
    await creditCoins(db, {
      uid,
      amount,
      type: "champion_reward",
      refId: `${tournamentId}_champion_${uid}`,
      metadata: { tournamentId, role: "champion" },
    });
  }
}

export async function recordTournamentHeartbeat(
  db: Firestore,
  matchId: string,
  uid: string
): Promise<void> {
  const matchRef = db.collection("matches").doc(matchId);
  const matchSnap = await matchRef.get();
  if (!matchSnap.exists) throw new Error("Match not found.");

  const match = matchSnap.data()!;
  if (!match.tournamentId) throw new Error("Not a tournament match.");
  if (match.status === "completed" || match.status === "abandoned") return;

  const playerUids = (match.playerUids as string[]) ?? [];
  if (!playerUids.includes(uid)) throw new Error("Not a match participant.");

  await matchRef.update({
    [`tournamentHeartbeats.${uid}`]: Date.now(),
  });
}

export async function checkTournamentDisconnectForfeit(
  db: Firestore,
  matchId: string
): Promise<{ forfeited: boolean; winnerTeamId?: string }> {
  const matchRef = db.collection("matches").doc(matchId);
  const matchSnap = await matchRef.get();
  if (!matchSnap.exists) return { forfeited: false };

  const match = matchSnap.data()!;
  const tournamentId = match.tournamentId as string | undefined;
  if (!tournamentId) return { forfeited: false };
  if (match.status === "completed" || match.status === "abandoned") {
    return { forfeited: false };
  }

  const heartbeats =
    (match.tournamentHeartbeats as Record<string, number> | undefined) ?? {};
  const team1Id = match.tournamentTeam1Id as string;
  const team2Id = match.tournamentTeam2Id as string;
  const now = Date.now();

  const team1Members = await loadTeamMembers(db, tournamentId, team1Id);
  const team2Members = await loadTeamMembers(db, tournamentId, team2Id);
  if (!team1Members || !team2Members) return { forfeited: false };

  const team1Stale = team1Members.some(
    (p) => now - (heartbeats[p.uid] ?? 0) >= TOURNAMENT_DISCONNECT_FORFEIT_MS
  );
  const team2Stale = team2Members.some(
    (p) => now - (heartbeats[p.uid] ?? 0) >= TOURNAMENT_DISCONNECT_FORFEIT_MS
  );

  if (!team1Stale && !team2Stale) return { forfeited: false };
  if (team1Stale && team2Stale) return { forfeited: false };

  const winnerTeamId = team1Stale ? team2Id : team1Id;
  const winnerTeam: 1 | 2 = team1Stale ? 2 : 1;

  await matchRef.update({
    status: "completed",
    winnerTeam,
    endReason: "disconnect_forfeit",
    completedAt: FieldValue.serverTimestamp(),
  });

  await advanceTournamentOnMatchComplete(
    db,
    tournamentId,
    matchId,
    winnerTeamId
  );

  return { forfeited: true, winnerTeamId };
}

export async function checkTournamentForfeits(
  db: Firestore,
  tournamentId: string
): Promise<number> {
  const tournamentSnap = await db
    .collection("tournaments")
    .doc(tournamentId)
    .get();
  if (!tournamentSnap.exists) return 0;
  const bracket =
    (tournamentSnap.data()?.bracket as TournamentBracketMatch[]) ?? [];
  let count = 0;
  for (const m of bracket) {
    if (!m.matchId || m.winnerTeamId) continue;
    const result = await checkTournamentDisconnectForfeit(db, m.matchId);
    if (result.forfeited) count += 1;
  }
  return count;
}
