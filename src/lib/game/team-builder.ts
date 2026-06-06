import type { MatchmakingMember } from "@/types/firestore";
import type { BoardId } from "./bughouse-rules";

export type QueueUnitMember = MatchmakingMember;

export function slotCount(members: QueueUnitMember[]): number {
  return members.length;
}

/** Assign 4 players to official Bughouse seats (T1: White Alpha + Black Bravo, T2: Black Alpha + White Bravo). */
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
    const flat = units.flat();
    team1 = flat.slice(0, 2);
    team2 = flat.slice(2, 4);
  } else {
    throw new Error("Unsupported queue unit composition");
  }

  const mapPlayer = (
    member: QueueUnitMember,
    boardId: BoardId,
    team: 1 | 2
  ) => {
    const base = {
      uid: member.uid,
      displayName: member.displayName,
      photoURL: member.photoURL,
      boardId,
      team,
      rating: member.rating,
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
  };

  return [
    mapPlayer(team1[0]!, "board-a", 1),
    mapPlayer(team1[1]!, "board-d", 1),
    mapPlayer(team2[0]!, "board-c", 2),
    mapPlayer(team2[1]!, "board-b", 2),
  ];
}

/** Find queue entries that fill 4 slots and include the given entry id. */
export function findQueueCombo<T extends { id: string; members: QueueUnitMember[] }>(
  entries: T[],
  mustIncludeEntryId: string
): T[] | null {
  const anchor = entries.find((e) => e.id === mustIncludeEntryId);
  if (!anchor) return null;

  const need = 4 - anchor.members.length;
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
