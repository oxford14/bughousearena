import type { MatchmakingMember } from "@/types/firestore";
import type { BoardId } from "./bughouse-rules";

export type QueueUnitMember = MatchmakingMember;

const MAIN_BOARD_ID = "main";

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

export function slotCount(members: QueueUnitMember[]): number {
  return members.length;
}

function mapPlayer(
  member: QueueUnitMember,
  boardId: string,
  team: 1 | 2,
  playerColor?: "w" | "b"
) {
  const base = {
    uid: member.uid,
    displayName: member.displayName,
    photoURL: member.photoURL,
    boardId,
    team,
    rating: member.rating,
    ...(playerColor ? { playerColor } : {}),
  };
  if (member.isBot) {
    return {
      ...base,
      isBot: true as const,
      botSkill: member.botSkill,
      rankTier: member.rankTier,
    };
  }
  return base;
}

/** Assign 2 players to a single board (White = team 1, Black = team 2). */
export function assignTwoPlayersFromUnits(
  units: QueueUnitMember[][]
): ReturnType<typeof mapPlayer>[] {
  const flat = units.flat();
  if (flat.length !== 2) {
    throw new Error(`Expected 2 players, got ${flat.length}`);
  }
  const [a, b] = shuffle(flat);
  return [
    mapPlayer(a!, MAIN_BOARD_ID, 1, "w"),
    mapPlayer(b!, MAIN_BOARD_ID, 2, "b"),
  ];
}

/** Assign 4 players to official Bughouse seats. */
export function assignPlayersFromUnits(
  units: QueueUnitMember[][]
): {
  uid: string;
  displayName: string;
  photoURL: string | null;
  boardId: BoardId;
  team: 1 | 2;
  rating: number;
}[] {
  const total = units.reduce((sum, unit) => sum + unit.length, 0);
  if (total !== 4) {
    throw new Error(`Expected 4 players, got ${total}`);
  }

  let team1: QueueUnitMember[];
  let team2: QueueUnitMember[];

  if (units.length === 2 && units.every((u) => u.length === 2)) {
    team1 = units[0]!;
    team2 = units[1]!;
  } else if (units.length === 3) {
    const pair = units.find((u) => u.length === 2);
    if (!pair) throw new Error("Invalid 3-unit queue composition");
    team1 = pair;
    team2 = units.filter((u) => u.length === 1).flat();
  } else if (units.length === 4 && units.every((u) => u.length === 1)) {
    const flat = shuffle(units.flat());
    team1 = flat.slice(0, 2);
    team2 = flat.slice(2, 4);
  } else {
    throw new Error("Unsupported queue unit composition");
  }

  return [
    mapPlayer(team1[0]!, "board-a", 1) as ReturnType<
      typeof assignPlayersFromUnits
    >[number],
    mapPlayer(team1[1]!, "board-d", 1) as ReturnType<
      typeof assignPlayersFromUnits
    >[number],
    mapPlayer(team2[0]!, "board-c", 2) as ReturnType<
      typeof assignPlayersFromUnits
    >[number],
    mapPlayer(team2[1]!, "board-b", 2) as ReturnType<
      typeof assignPlayersFromUnits
    >[number],
  ];
}

/** Find queue entries that fill `needSlots` and include the given entry id. */
export function findQueueCombo<
  T extends { id: string; members: QueueUnitMember[] },
>(
  entries: T[],
  mustIncludeEntryId: string,
  needSlots = 4
): T[] | null {
  const anchor = entries.find((e) => e.id === mustIncludeEntryId);
  if (!anchor) return null;

  const need = needSlots - anchor.members.length;
  if (need < 0) return null;
  if (need === 0) return [anchor];

  const rest = entries.filter((e) => e.id !== mustIncludeEntryId);

  function search(
    remaining: T[],
    slotsNeeded: number,
    picked: T[]
  ): T[] | null {
    if (slotsNeeded === 0) return picked;
    if (remaining.length === 0) return null;

    for (let i = 0; i < remaining.length; i++) {
      const entry = remaining[i]!;
      const slots = entry.members.length;
      if (slots > slotsNeeded) continue;
      const result = search(
        remaining.slice(i + 1),
        slotsNeeded - slots,
        [...picked, entry]
      );
      if (result) return result;
    }
    return null;
  }

  return search(rest, need, [anchor]);
}

export function averageRating(members: QueueUnitMember[]): number {
  if (members.length === 0) return 1200;
  return Math.round(
    members.reduce((sum, m) => sum + m.rating, 0) / members.length
  );
}
