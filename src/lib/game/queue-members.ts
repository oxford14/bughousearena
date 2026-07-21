import type {
  ChessGameType,
  MatchmakingMember,
  PartyDocument,
  UserProfile,
} from "@/types/firestore";
import { getRatingForGameType, normalizeGameType } from "./game-types";

function toMatchmakingMember(
  user: UserProfile,
  gameType: ChessGameType
): MatchmakingMember {
  return {
    uid: user.uid,
    displayName: user.displayName,
    photoURL: user.photoURL,
    rating: getRatingForGameType(user, gameType),
  };
}

function toMatchmakingMemberFromParty(
  m: PartyDocument["members"][number]
): MatchmakingMember {
  return {
    uid: m.uid,
    displayName: m.displayName,
    photoURL: m.photoURL,
    rating: m.rating,
  };
}

/** Only the queuing player is included; party partners must opt in via readyUids. */
export function resolveQueueMembers(
  user: UserProfile,
  party?: PartyDocument | null,
  gameType: ChessGameType = "bughouse"
): MatchmakingMember[] {
  const type = normalizeGameType(gameType);
  const self = toMatchmakingMember(user, type);

  // 1v1 / solo modes never queue with a party.
  if (type !== "bughouse") {
    return [self];
  }

  if (!party || party.members.length <= 1) {
    return [self];
  }

  const readyOthers = party.members.filter(
    (m) => m.uid !== user.uid && party.readyUids?.includes(m.uid)
  );
  if (readyOthers.length === 0) {
    return [self];
  }

  const byUid = new Map<string, MatchmakingMember>([[self.uid, self]]);
  for (const member of readyOthers) {
    byUid.set(member.uid, toMatchmakingMemberFromParty(member));
  }
  return [...byUid.values()];
}
