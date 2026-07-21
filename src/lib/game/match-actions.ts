import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  serverTimestamp,
  writeBatch,
  type DocumentData,
  type DocumentReference,
} from "firebase/firestore";
import { Chess, type Square } from "chess.js";
import { getFirebaseDb } from "@/lib/firebase/config";
import { serializeBoard } from "@/lib/firebase/firestore-write";
import {
  applyAction,
  BOARD_IDS,
  evaluateMatchEnd,
  getPhysicalBoard,
  getSeatColor,
  matchClocksStarted,
  inferGlobalClockStartMs,
  reservePieceFromCapture,
  snapshotFromBoardDocs,
  tickAllPhysicalClocks,
  type BoardSeatId,
  type GameAction,
  type PieceSymbol,
  type BughouseSnapshot,
} from "@/lib/game/bughouse-engine";
import type { BoardDocument, MatchDocument, MatchEndReason } from "@/types/firestore";
import { matchTimeControlSeconds } from "@/lib/game/time-control";
import { normalizeGameType } from "@/lib/game/game-types";
import {
  applySingleBoardDrop,
  applySingleBoardMove,
  checkSingleBoardTimeForfeit,
  SINGLE_BOARD_ID,
  type PieceSymbol as SinglePieceSymbol,
} from "@/lib/game/single-board-engine";

export interface SubmitMoveParams {
  matchId: string;
  boardId: string;
  playerId: string;
  move: string;
  promotion?: PieceSymbol;
}

export interface SubmitMoveResult {
  ok: boolean;
  error?: string;
}

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

async function loadMatchContext(matchId: string) {
  const db = getFirebaseDb();
  const matchRef = doc(db, "matches", matchId);
  const matchSnap = await getDoc(matchRef);
  if (!matchSnap.exists()) return null;

  const boardsSnap = await getDocs(collection(db, "matches", matchId, "boards"));
  const boards = boardsSnap.docs.map(
    (d) => ({ id: d.id, ...d.data() }) as BoardDocument
  );

  return {
    match: { id: matchSnap.id, ...matchSnap.data() } as MatchDocument,
    boards,
    db,
  };
}

function boardDocsFromSnapshot(
  boards: BoardDocument[],
  snapshot: BughouseSnapshot
): BoardDocument[] {
  return boards.map((existing) => {
    const physicalId = getPhysicalBoard(existing.id as BoardSeatId);
    const physical = snapshot.physical[physicalId];
    const seat = snapshot.seats[existing.id as BoardSeatId];
    return {
      ...existing,
      fen: physical.fen,
      captured: seat.reserve,
      turn: physical.fen.includes(" w ") ? "w" : "b",
      boardStatus: physical.status,
      promotedSquares: Object.keys(physical.promotedSquares),
      whiteClock: physical.whiteClock,
      blackClock: physical.blackClock,
      clockRunning: physical.clockRunning,
      clockUpdatedAtMs: physical.clockUpdatedAtMs,
    };
  });
}

async function persistSnapshotBoards(
  matchId: string,
  boards: BoardDocument[],
  snapshot: BughouseSnapshot,
  extra?: { complete?: { winnerTeam: 1 | 2; endReason: MatchEndReason } }
) {
  const db = getFirebaseDb();
  const updatedBoards = boardDocsFromSnapshot(boards, snapshot);
  const batch = writeBatch(db);

  for (const board of updatedBoards) {
    batch.update(doc(db, "matches", matchId, "boards", board.id), serializeBoard(board));
  }

  if (extra?.complete) {
    batch.update(doc(db, "matches", matchId), {
      status: "completed",
      winnerTeam: extra.complete.winnerTeam,
      endReason: extra.complete.endReason,
      completedAt: serverTimestamp(),
    });
  }

  await batch.commit();
}

function completeMatchUpdate(
  winnerTeam: 1 | 2,
  endReason: MatchEndReason,
  resignedByUid?: string
) {
  return {
    status: "completed" as const,
    winnerTeam,
    endReason,
    completedAt: serverTimestamp(),
    ...(resignedByUid ? { resignedByUid } : {}),
  };
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
      clockRunning: b.clockRunning,
      clockUpdatedAtMs: b.clockUpdatedAtMs,
    }))
  );
}

type SeatUpdater = (ref: DocumentReference, data: DocumentData) => void;

/**
 * Persist every seat doc — partner reserves live on the other physical board.
 * Must run inside a transaction so concurrent moves on the two physical boards
 * don't clobber each other's FEN/turn/reserve state.
 */
function writeAllSeats(
  update: SeatUpdater,
  matchId: string,
  boards: BoardDocument[],
  snapshot: BughouseSnapshot,
  actingSeatId?: BoardSeatId,
  lastMove?: string,
  matchPlayers?: MatchDocument["players"]
) {
  const db = getFirebaseDb();
  for (const seatId of BOARD_IDS) {
    const existing = boards.find((b) => b.id === seatId);
    if (!existing) continue;

    const physicalId = getPhysicalBoard(seatId);
    const physical = snapshot.physical[physicalId];
    const seat = snapshot.seats[seatId];
    const seatedPlayer = matchPlayers?.find((p) => p.boardId === seatId);

    update(
      doc(db, "matches", matchId, "boards", seatId),
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

/**
 * Server-side move validation and atomic board updates.
 */
export async function submitValidatedMove(
  params: SubmitMoveParams
): Promise<SubmitMoveResult> {
  const db = getFirebaseDb();
  const matchRef = doc(db, "matches", params.matchId);

  // Peek game type without a full transaction first path for 1v1.
  const peek = await getDoc(matchRef);
  if (!peek.exists()) return { ok: false, error: "Match not found" };
  const peekMatch = { id: peek.id, ...peek.data() } as MatchDocument;
  if (normalizeGameType(peekMatch.gameType) !== "bughouse") {
    return submitSingleBoardValidatedMove(params, peekMatch);
  }

  const boardId = params.boardId as BoardSeatId;

  try {
    const outcome = await runTransaction<SubmitMoveResult>(db, async (tx) => {
      const matchSnap = await tx.get(matchRef);
      if (!matchSnap.exists()) return { ok: false, error: "Match not found" };

      const match = { id: matchSnap.id, ...matchSnap.data() } as MatchDocument;
      if (match.status !== "active") {
        return { ok: false, error: "Match is not active" };
      }

      const boardRefs = BOARD_IDS.map((id) =>
        doc(db, "matches", params.matchId, "boards", id)
      );
      const boardSnaps = await Promise.all(boardRefs.map((ref) => tx.get(ref)));
      const boards = boardSnaps
        .filter((s) => s.exists())
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
        match.startedAt?.toMillis?.() ??
        undefined;

      const snapshot = tickAllPhysicalClocks(preSnapshot, nowMs);

      const wasMatchClocksStarted = matchClocksStarted(snapshot);

      const timeForfeit = evaluateMatchEnd(snapshot);
      if (
        timeForfeit.ended &&
        timeForfeit.reason === "time_forfeit" &&
        timeForfeit.winnerTeam
      ) {
        writeAllSeats(
          (ref, data) => tx.update(ref, data),
          params.matchId,
          boards,
          snapshot,
          undefined,
          undefined,
          match.players
        );
        tx.update(matchRef, completeMatchUpdate(timeForfeit.winnerTeam, "time_forfeit"));
        return { ok: false, error: "Clock expired" };
      }

      const action = parseAction(boardId, params.move, params.promotion);
      if (!action) return { ok: false, error: "Invalid action" };

      const result = applyAction(snapshot, action, nowMs, clocksAnchor);
      if (!result.valid || !result.snapshot) {
        return { ok: false, error: result.error ?? "Illegal action" };
      }

      writeAllSeats(
        (ref, data) => tx.update(ref, data),
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
        await addDoc(collection(db, "matches", params.matchId, "moves"), {
          boardId,
          playerId: params.playerId,
          move: params.move,
          validated: true,
          createdAt: serverTimestamp(),
        });
      } catch (error) {
        console.warn("[match-actions] move audit log failed", error);
      }
    }

    return outcome;
  } catch (error) {
    console.warn("[match-actions] move transaction failed", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Move failed",
    };
  }
}

async function submitSingleBoardValidatedMove(
  params: SubmitMoveParams,
  peekMatch: MatchDocument
): Promise<SubmitMoveResult> {
  const db = getFirebaseDb();
  const matchRef = doc(db, "matches", params.matchId);
  const boardRef = doc(
    db,
    "matches",
    params.matchId,
    "boards",
    params.boardId || SINGLE_BOARD_ID
  );
  const gameType = normalizeGameType(peekMatch.gameType);

  try {
    const outcome = await runTransaction<SubmitMoveResult>(db, async (tx) => {
      const matchSnap = await tx.get(matchRef);
      if (!matchSnap.exists()) return { ok: false, error: "Match not found" };
      const match = { id: matchSnap.id, ...matchSnap.data() } as MatchDocument;
      if (match.status !== "active") {
        return { ok: false, error: "Match is not active" };
      }

      const boardSnap = await tx.get(boardRef);
      if (!boardSnap.exists()) return { ok: false, error: "Board not found" };
      const board = { id: boardSnap.id, ...boardSnap.data() } as BoardDocument;

      const player = match.players.find((p) => p.uid === params.playerId);
      if (!player) return { ok: false, error: "Not in this match" };

      const playerColor = player.playerColor ?? (player.team === 1 ? "w" : "b");
      const nowMs = Date.now();

      const timed = checkSingleBoardTimeForfeit(board, nowMs);
      if (timed?.matchEnded && timed.winnerTeam && timed.board) {
        tx.update(boardRef, serializeBoard(timed.board));
        tx.update(
          matchRef,
          completeMatchUpdate(timed.winnerTeam, timed.endReason ?? "time_forfeit")
        );
        return { ok: false, error: "Clock expired" };
      }

      const isDrop =
        params.move.includes("@") || params.move.startsWith("drop:");

      let result;
      if (isDrop) {
        if (gameType !== "crazyhouse") {
          return { ok: false, error: "Drops only allowed in Crazyhouse" };
        }
        let piece: SinglePieceSymbol;
        let to: Square;
        if (params.move.startsWith("drop:")) {
          const [, rest] = params.move.split(":");
          const [p, sq] = rest!.split("@");
          piece = p as SinglePieceSymbol;
          to = sq as Square;
        } else {
          const [p, sq] = params.move.split("@");
          piece = p as SinglePieceSymbol;
          to = sq as Square;
        }
        result = applySingleBoardDrop({
          board,
          playerId: params.playerId,
          playerColor,
          piece,
          to,
          nowMs,
        });
      } else {
        result = applySingleBoardMove({
          board,
          gameType,
          playerId: params.playerId,
          playerColor,
          move: params.move,
          promotion: params.promotion as SinglePieceSymbol | undefined,
          nowMs,
        });
      }

      if (!result.ok || !result.board) {
        return { ok: false, error: result.error ?? "Illegal move" };
      }

      tx.update(boardRef, serializeBoard(result.board));

      const matchPatch: Record<string, unknown> = {};
      if (!match.clocksStartedAtMs) {
        matchPatch.clocksStartedAtMs = nowMs;
      }
      if (result.matchEnded && result.winnerTeam && result.endReason) {
        Object.assign(
          matchPatch,
          completeMatchUpdate(result.winnerTeam, result.endReason)
        );
      } else if (result.matchEnded && result.winnerTeam) {
        Object.assign(
          matchPatch,
          completeMatchUpdate(result.winnerTeam, "checkmate")
        );
      } else if (result.matchEnded) {
        // Draw — mark completed without winner
        Object.assign(matchPatch, {
          status: "completed",
          completedAt: serverTimestamp(),
          winnerTeam: null,
          endReason: "checkmate",
        });
      }

      if (Object.keys(matchPatch).length > 0) {
        tx.update(matchRef, matchPatch);
      }

      return { ok: true };
    });

    if (outcome.ok) {
      try {
        await addDoc(collection(db, "matches", params.matchId, "moves"), {
          boardId: params.boardId || SINGLE_BOARD_ID,
          playerId: params.playerId,
          move: params.move,
          validated: true,
          createdAt: serverTimestamp(),
        });
      } catch (error) {
        console.warn("[match-actions] move audit log failed", error);
      }
    }

    return outcome;
  } catch (error) {
    console.warn("[match-actions] single-board move failed", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Move failed",
    };
  }
}

/** Sync clocks and end the match when a physical-board clock hits zero. */
export async function submitTimeForfeit(matchId: string): Promise<void> {
  const ctx = await loadMatchContext(matchId);
  if (!ctx) return;

  const { match, boards } = ctx;
  if (match.status !== "active") return;

  if (normalizeGameType(match.gameType) !== "bughouse") {
    const board = boards.find((b) => b.id === SINGLE_BOARD_ID) ?? boards[0];
    if (!board) return;
    const timed = checkSingleBoardTimeForfeit(board);
    if (!timed?.matchEnded || !timed.winnerTeam || !timed.board) return;
    const batch = writeBatch(ctx.db);
    batch.update(
      doc(ctx.db, "matches", matchId, "boards", board.id),
      serializeBoard(timed.board)
    );
    batch.update(
      doc(ctx.db, "matches", matchId),
      completeMatchUpdate(timed.winnerTeam, timed.endReason ?? "time_forfeit")
    );
    await batch.commit();
    return;
  }

  const snapshot = tickAllPhysicalClocks(loadSnapshotFromBoards(boards), Date.now());
  const endState = evaluateMatchEnd(snapshot);
  if (!endState.ended || endState.reason !== "time_forfeit" || !endState.winnerTeam) {
    return;
  }

  await persistSnapshotBoards(matchId, boards, snapshot, {
    complete: { winnerTeam: endState.winnerTeam, endReason: "time_forfeit" },
  });
}

/** Resignation forfeits the entire team. */
export async function submitResign(
  matchId: string,
  playerId: string
): Promise<SubmitMoveResult> {
  const ctx = await loadMatchContext(matchId);
  if (!ctx) return { ok: false, error: "Match not found" };

  const { match, db } = ctx;
  if (match.status !== "active") {
    return { ok: false, error: "Match is not active" };
  }

  const player = match.players.find((p) => p.uid === playerId);
  if (!player) {
    return { ok: false, error: "Not in this match" };
  }

  const winnerTeam = player.team === 1 ? 2 : 1;

  const batch = writeBatch(db);
  batch.update(
    doc(db, "matches", matchId),
    completeMatchUpdate(winnerTeam, "resignation", playerId)
  );
  await batch.commit();

  return { ok: true };
}

export function computeCaptureForPartner(
  fen: string,
  move: string,
  promotedSquares: string[] = [],
  promotion?: PieceSymbol
): PieceSymbol | null {
  const board = new Chess(fen);
  let result;
  try {
    if (promotion) {
      result = board.move({
        from: move.slice(0, 2),
        to: move.slice(2, 4),
        promotion,
      });
    } else {
      result = board.move(move);
    }
  } catch {
    return null;
  }
  if (!result?.captured) return null;
  const promoted = Object.fromEntries(promotedSquares.map((sq) => [sq, true]));
  return reservePieceFromCapture(result.captured, result.to, promoted);
}
