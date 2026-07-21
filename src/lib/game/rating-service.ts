import {
  doc,
  getDoc,
  increment,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/config";
import { isBotUid } from "@/lib/game/bots";
import { calculateElo } from "@/lib/game/elo-calc";
import {
  DEFAULT_RATING,
  normalizeGameType,
  type ChessGameType,
} from "@/lib/game/game-types";
import type { MatchDocument, MatchPlayer } from "@/types/firestore";

const RANKED_K = 32;

function teamAverageRating(players: MatchPlayer[], team: 1 | 2): number {
  const teamPlayers = players.filter((p) => p.team === team);
  if (teamPlayers.length === 0) return DEFAULT_RATING;
  return Math.round(
    teamPlayers.reduce((sum, p) => sum + (p.rating ?? DEFAULT_RATING), 0) /
      teamPlayers.length
  );
}

/** ELO delta for one human in a completed ranked/rated match. */
export function computeRankedRatingDelta(
  match: MatchDocument,
  uid: string
): number | null {
  if (match.mode !== "ranked") return null;
  if (match.status !== "completed" || match.winnerTeam == null) return null;

  const player = match.players.find((p) => p.uid === uid);
  if (!player || player.isBot || isBotUid(player.uid)) return null;

  const myTeam = player.team;
  const won = match.winnerTeam === myTeam;
  const score: 1 | 0 = won ? 1 : 0;
  const opponentTeam = myTeam === 1 ? 2 : 1;
  const opponentRating = teamAverageRating(match.players, opponentTeam);
  const currentRating = player.rating ?? DEFAULT_RATING;
  const newRating = calculateElo(currentRating, opponentRating, score, RANKED_K);
  return newRating - currentRating;
}

function ratingFieldsForGameType(gameType: ChessGameType): {
  rating: string;
  wins: string;
  losses: string;
} {
  if (gameType === "standard") {
    return {
      rating: "standardRating",
      wins: "standardRankedWins",
      losses: "standardRankedLosses",
    };
  }
  if (gameType === "crazyhouse") {
    return {
      rating: "crazyhouseRating",
      wins: "crazyhouseRankedWins",
      losses: "crazyhouseRankedLosses",
    };
  }
  if (gameType === "atomic") {
    return {
      rating: "atomicRating",
      wins: "atomicRankedWins",
      losses: "atomicRankedLosses",
    };
  }
  return {
    rating: "rating",
    wins: "rankedWins",
    losses: "rankedLosses",
  };
}

/**
 * Apply ranked ELO once per user per match (idempotent via lastRatedMatchId).
 * Returns the rating change, or null if not applicable / already applied.
 */
export async function applyRankedRatingForUser(
  matchId: string,
  uid: string
): Promise<number | null> {
  const db = getFirebaseDb();
  const userRef = doc(db, "users", uid);
  const matchRef = doc(db, "matches", matchId);
  const leaderboardRef = doc(db, "leaderboards", "global", "entries", uid);

  return runTransaction(db, async (transaction) => {
    const [userSnap, matchSnap] = await Promise.all([
      transaction.get(userRef),
      transaction.get(matchRef),
    ]);

    if (!userSnap.exists() || !matchSnap.exists()) return null;

    const userData = userSnap.data();
    if (userData.lastRatedMatchId === matchId) {
      return (userData.lastRatingChange as number | undefined) ?? null;
    }

    const match = { id: matchSnap.id, ...matchSnap.data() } as MatchDocument;
    const delta = computeRankedRatingDelta(match, uid);
    if (delta == null) return null;

    const gameType = normalizeGameType(match.gameType);
    const fields = ratingFieldsForGameType(gameType);
    const currentRating =
      (userData[fields.rating] as number | undefined) ?? DEFAULT_RATING;
    const newRating = currentRating + delta;
    const won =
      match.winnerTeam === match.players.find((p) => p.uid === uid)?.team;

    transaction.update(userRef, {
      [fields.rating]: newRating,
      lastRatedMatchId: matchId,
      lastRatingChange: delta,
      [fields.wins]: increment(won ? 1 : 0),
      [fields.losses]: increment(won ? 0 : 1),
    });

    // Global leaderboard stays Bughouse-primary.
    if (gameType === "bughouse") {
      transaction.set(
        leaderboardRef,
        {
          uid,
          displayName: userData.displayName ?? "Player",
          photoURL: userData.photoURL ?? null,
          rating: newRating,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }

    return delta;
  });
}

/** Read cached rating change after apply, without writing. */
export async function getStoredRatingChange(
  uid: string,
  matchId: string
): Promise<number | null> {
  const userSnap = await getDoc(doc(getFirebaseDb(), "users", uid));
  if (!userSnap.exists()) return null;
  const data = userSnap.data();
  if (data.lastRatedMatchId !== matchId) return null;
  return (data.lastRatingChange as number | undefined) ?? null;
}
