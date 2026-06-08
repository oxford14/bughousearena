import { FieldValue, type Firestore, type Transaction } from "firebase-admin/firestore";
import { Chess, type Square } from "chess.js";
import { serializeBoard } from "@/lib/firebase/firestore-write";
import {
  applyAction,
  BOARD_IDS,
  evaluateMatchEnd,
  getPhysicalBoard,
  getSeatColor,
  inferGlobalClockStartMs,
  matchClocksStarted,
  snapshotFromBoardDocs,
  tickAllPhysicalClocks,
  type BoardSeatId,
  type BughouseSnapshot,
  type GameAction,
  type PieceSymbol,
} from "@/lib/game/bughouse-engine";
import type { BoardDocument, MatchDocument, MatchEndReason } from "@/types/firestore";
import { matchTimeControlSeconds } from "@/lib/game/time-control";
import { isBotUid } from "@/lib/game/bots";
import type { SubmitMoveParams, SubmitMoveResult } from "@/lib/game/match-actions";

function playerOwnsBoardSeat(
  match: MatchDocument,
  board: BoardDocument | undefined,
  boardId: string,
  playerId: string
): boolean {
  if (!board) return false;
  if (board.playerUid === playerId) return true;
  return match.players.some((p) => p.uid === playerId && p.boardId === boardId);
}

function loadSnapshotFromBoards(boards: BoardDocument[]) {
  return snapshotFromBoardDocs(
    boards.map((b) => ({
      id: b.id,
      fen: b.fen,
      captured: b.captured,
      playerUid: b.playerUid,
      promotedSquares: b.promotedSquares,
      boardStatus: b.boardStatus,
      whiteClock: b.whiteClock,
      blackClock: b.blackClock,
      clockRunning: b.clockRunning ?? null,
      clockUpdatedAtMs: b.clockUpdatedAtMs,
    }))
  );
}

function completeMatchUpdate(winnerTeam: 1 | 2, endReason: MatchEndReason) {
  return {
    status: "completed" as const,
    winnerTeam,
    endReason,
    completedAt: FieldValue.serverTimestamp(),
  };
}

function parseAction(
  boardId: BoardSeatId,
  move: string,
  promotion?: PieceSymbol
): GameAction | null {
  if (move.startsWith("drop:")) {
    const [, rest] = move.split(":");
    const [piece, square] = rest!.split("@");
    return {
      type: "drop",
      seatId: boardId,
      piece: piece as PieceSymbol,
      square: square as Square,
    };
  }
  if (move.includes("@")) {
    const [piece, square] = move.split("@");
    return {
      type: "drop",
      seatId: boardId,
      piece: piece as PieceSymbol,
      square: square as Square,
    };
  }
  return { type: "move", seatId: boardId, move, promotion };
}

function writeAllSeatsAdmin(
  tx: Transaction,
  db: Firestore,
  matchId: string,
  boards: BoardDocument[],
  snapshot: BughouseSnapshot,
  actingSeatId?: BoardSeatId,
  lastMove?: string,
  matchPlayers?: MatchDocument["players"]
) {
  for (const seatId of BOARD_IDS) {
    const existing = boards.find((b) => b.id === seatId);
    if (!existing) continue;

    const physicalId = getPhysicalBoard(seatId);
    const physical = snapshot.physical[physicalId];
    const seat = snapshot.seats[seatId];
    const seatedPlayer = matchPlayers?.find((p) => p.boardId === seatId);

    tx.update(
      db.collection("matches").doc(matchId).collection("boards").doc(seatId),
      serializeBoard({
        ...existing,
        playerUid: seatedPlayer?.uid ?? existing.playerUid,
        playerColor: seatedPlayer?.playerColor ?? existing.playerColor,
        fen: physical.fen,
        captured: seat.reserve,
        turn: physical.fen.includes(" w ") ? "w" : "b",
        lastMove: actingSeatId === seatId && lastMove ? lastMove : existing.lastMove,
        isCheck: new Chess(physical.fen).isCheck(),
        isGameOver: physical.status !== "active",
        boardStatus: physical.status,
        promotedSquares: Object.keys(physical.promotedSquares),
        whiteClock: physical.whiteClock,
        blackClock: physical.blackClock,
        clockRunning: physical.clockRunning,
        clockUpdatedAtMs: physical.clockUpdatedAtMs,
      })
    );
  }
}

function startedAtMs(match: MatchDocument): number | undefined {
  const started = match.startedAt as { toMillis?: () => number } | null | undefined;
  return started?.toMillis?.();
}

/** Server-side move validation for bot moves (bypasses client Firestore rule edge cases). */
export async function submitValidatedMoveAdmin(
  db: Firestore,
  params: SubmitMoveParams,
  callerUid: string
): Promise<SubmitMoveResult> {
  const matchRef = db.collection("matches").doc(params.matchId);
  const boardId = params.boardId as BoardSeatId;

  try {
    const outcome = await db.runTransaction(async (tx) => {
      const matchSnap = await tx.get(matchRef);
      if (!matchSnap.exists) return { ok: false, error: "Match not found" };

      const match = { id: matchSnap.id, ...matchSnap.data() } as MatchDocument;
      if (match.status !== "active") {
        return { ok: false, error: "Match is not active" };
      }

      const humanUids = match.playerUids ?? match.players.filter((p) => !p.isBot).map((p) => p.uid);
      if (!humanUids.includes(callerUid)) {
        return { ok: false, error: "Not a match participant" };
      }

      if (!isBotUid(params.playerId)) {
        return { ok: false, error: "Bot moves only" };
      }

      const botInMatch = match.players.some((p) => p.uid === params.playerId);
      if (!botInMatch) {
        return { ok: false, error: "Unknown bot player" };
      }

      const boardSnaps = await Promise.all(
        BOARD_IDS.map((id) => tx.get(matchRef.collection("boards").doc(id)))
      );
      const boards = boardSnaps
        .filter((s) => s.exists)
        .map((s) => ({ id: s.id, ...s.data() }) as BoardDocument);

      const board = boards.find((b) => b.id === boardId);
      if (!board || !playerOwnsBoardSeat(match, board, boardId, params.playerId)) {
        return { ok: false, error: "Not your board" };
      }
      if (board.boardStatus && board.boardStatus !== "active") {
        return { ok: false, error: "This board is frozen" };
      }

      const nowMs = Date.now();
      const preSnapshot = loadSnapshotFromBoards(boards);
      const inferredAnchor = inferGlobalClockStartMs(
        preSnapshot,
        matchTimeControlSeconds(match),
        nowMs
      );
      const clocksAnchor =
        match.clocksStartedAtMs ??
        inferredAnchor ??
        startedAtMs(match) ??
        undefined;

      const snapshot = tickAllPhysicalClocks(preSnapshot, nowMs);
      const wasMatchClocksStarted = matchClocksStarted(snapshot);

      const timeForfeit = evaluateMatchEnd(snapshot);
      if (
        timeForfeit.ended &&
        timeForfeit.reason === "time_forfeit" &&
        timeForfeit.winnerTeam
      ) {
        writeAllSeatsAdmin(tx, db, params.matchId, boards, snapshot, undefined, undefined, match.players);
        tx.update(matchRef, completeMatchUpdate(timeForfeit.winnerTeam, "time_forfeit"));
        return { ok: false, error: "Clock expired" };
      }

      const action = parseAction(boardId, params.move, params.promotion);
      if (!action) return { ok: false, error: "Invalid action" };

      const result = applyAction(snapshot, action, nowMs, clocksAnchor);
      if (!result.valid || !result.snapshot) {
        return { ok: false, error: result.error ?? "Illegal action" };
      }

      writeAllSeatsAdmin(
        tx,
        db,
        params.matchId,
        boards,
        result.snapshot,
        boardId,
        params.move,
        match.players
      );

      const matchPatch: Record<string, unknown> = {};

      if (
        !match.clocksStartedAtMs &&
        !wasMatchClocksStarted &&
        matchClocksStarted(result.snapshot)
      ) {
        matchPatch.clocksStartedAtMs = nowMs;
      }

      if (result.matchEnded && result.winnerTeam) {
        Object.assign(matchPatch, completeMatchUpdate(result.winnerTeam, "checkmate"));
      } else {
        const postMoveEnd = evaluateMatchEnd(result.snapshot);
        if (
          postMoveEnd.ended &&
          postMoveEnd.reason === "time_forfeit" &&
          postMoveEnd.winnerTeam
        ) {
          Object.assign(
            matchPatch,
            completeMatchUpdate(postMoveEnd.winnerTeam, "time_forfeit")
          );
        }
      }

      if (Object.keys(matchPatch).length > 0) {
        tx.update(matchRef, matchPatch);
      }

      return { ok: true };
    });

    if (outcome.ok) {
      try {
        await matchRef.collection("moves").add({
          boardId,
          playerId: params.playerId,
          move: params.move,
          validated: true,
          createdAt: FieldValue.serverTimestamp(),
        });
      } catch (error) {
        console.warn("[match-move-admin] move audit log failed", error);
      }
    }

    return outcome;
  } catch (error) {
    console.warn("[match-move-admin] transaction failed", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Move failed",
    };
  }
}
