import { initializeApp, getApps } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2";

export {
  createCoinCheckout,
  getCoinPurchaseStatus,
  paymongoWebhook,
} from "./shop";
export { purchaseShopItem, equipShopItem } from "./shop-inventory";

setGlobalOptions({ region: "us-central1", maxInstances: 10 });

function getDb() {
  if (!getApps().length) {
    initializeApp();
  }
  return getFirestore();
}

export const onUserCreate = onDocumentCreated(
  "users/{userId}",
  async (event) => {
    const uid = event.params.userId;
    const data = event.data?.data();
    if (!data) return;

    await getDb()
      .collection("leaderboards")
      .doc("global")
      .collection("entries")
      .doc(uid)
      .set({
        displayName: data.displayName,
        photoURL: data.photoURL ?? null,
        rating: data.rating ?? 1200,
        wins: 0,
      });
  }
);

export const validateMove = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be signed in.");
  }

  const { matchId, boardId, move, fen } = request.data as {
    matchId: string;
    boardId: string;
    move: string;
    fen: string;
  };

  const boardRef = getDb()
    .collection("matches")
    .doc(matchId)
    .collection("boards")
    .doc(boardId);
  const boardSnap = await boardRef.get();

  if (!boardSnap.exists) {
    throw new HttpsError("not-found", "Board not found.");
  }

  const boardData = boardSnap.data()!;
  if (boardData.playerUid !== request.auth.uid) {
    throw new HttpsError("permission-denied", "Not your board.");
  }

  const { Chess } = await import("chess.js");
  const chess = new Chess(fen);

  try {
    if (move.startsWith("drop:")) {
      const [, rest] = move.split(":");
      const [piece, square] = rest!.split("@");
      chess.remove(square as never);
      chess.put({ type: piece as never, color: chess.turn() }, square as never);
    } else {
      chess.move(move);
    }
  } catch {
    throw new HttpsError("invalid-argument", "Illegal move.");
  }

  await boardRef.update({
    fen: chess.fen(),
    lastMove: move,
    turn: chess.turn(),
    isCheck: chess.isCheck(),
    isGameOver: chess.isGameOver(),
  });

  await getDb().collection("matches").doc(matchId).collection("moves").add({
    boardId,
    playerId: request.auth.uid,
    move,
    validated: true,
    createdAt: FieldValue.serverTimestamp(),
  });

  return { valid: true, fen: chess.fen() };
});

export const updateRating = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be signed in.");
  }

  const { uid, opponentRating, score } = request.data as {
    uid: string;
    opponentRating: number;
    score: 1 | 0.5 | 0;
  };

  const userRef = getDb().collection("users").doc(uid);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    throw new HttpsError("not-found", "User not found.");
  }

  const rating = userSnap.data()!.rating as number;
  const expected = 1 / (1 + Math.pow(10, (opponentRating - rating) / 400));
  const newRating = Math.round(rating + 32 * (score - expected));

  await userRef.update({
    rating: newRating,
    rankedWins: FieldValue.increment(score === 1 ? 1 : 0),
    rankedLosses: FieldValue.increment(score === 0 ? 1 : 0),
  });

  await getDb()
    .collection("leaderboards")
    .doc("global")
    .collection("entries")
    .doc(uid)
    .update({ rating: newRating });

  return { newRating, change: newRating - rating };
});
