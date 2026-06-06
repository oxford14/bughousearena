import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  writeBatch,
  type WriteBatch,
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
  reservePieceFromCapture,
  snapshotFromBoardDocs,
  tickAllPhysicalClocks,
  type BoardSeatId,
  type GameAction,
  type PieceSymbol,
  type BughouseSnapshot,
} from "@/lib/game/bughouse-engine";
import type { BoardDocument, MatchDocument, MatchEndReason } from "@/types/firestore";

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

/** Persist every seat doc — partner reserves live on the other physical board. */
function writeAllSeatsToBatch(
  batch: WriteBatch,
  matchId: string,
  boards: BoardDocument[],
  snapshot: BughouseSnapshot,
  actingSeatId?: BoardSeatId,
  lastMove?: string
) {
  for (const seatId of BOARD_IDS) {
    const existing = boards.find((b) => b.id === seatId);
    if (!existing) continue;

    const physicalId = getPhysicalBoard(seatId);
    const physical = snapshot.physical[physicalId];
    const seat = snapshot.seats[seatId];

    batch.update(
      doc(getFirebaseDb(), "matches", matchId, "boards", seatId),
      serializeBoard({
        ...existing,
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

/** Server-side Bughouse move validation and atomic board updates. */
export async function submitValidatedMove(
  params: SubmitMoveParams
): Promise<SubmitMoveResult> {
  const ctx = await loadMatchContext(params.matchId);
  if (!ctx) return { ok: false, error: "Match not found" };

  const { match, boards, db } = ctx;
  if (match.status !== "active") {
    return { ok: false, error: "Match is not active" };
  }

  const boardId = params.boardId as BoardSeatId;
  const board = boards.find((b) => b.id === boardId);
  if (!board || board.playerUid !== params.playerId) {
    return { ok: false, error: "Not your board" };
  }

  if (board.boardStatus && board.boardStatus !== "active") {
    return { ok: false, error: "This board is frozen" };
  }

  const snapshot = tickAllPhysicalClocks(
    loadSnapshotFromBoards(boards),
    Date.now()
  );

  const timeForfeit = evaluateMatchEnd(snapshot);
  if (timeForfeit.ended && timeForfeit.reason === "time_forfeit" && timeForfeit.winnerTeam) {
    await persistSnapshotBoards(params.matchId, boards, snapshot, {
      complete: { winnerTeam: timeForfeit.winnerTeam, endReason: "time_forfeit" },
    });
    return { ok: false, error: "Clock expired" };
  }

  const action = parseAction(boardId, params.move, params.promotion);
  if (!action) return { ok: false, error: "Invalid action" };

  const result = applyAction(snapshot, action, Date.now());
  if (!result.valid || !result.snapshot) {
    return { ok: false, error: result.error ?? "Illegal action" };
  }

  const batch = writeBatch(db);
  writeAllSeatsToBatch(batch, params.matchId, boards, result.snapshot, boardId, params.move);

  if (result.matchEnded && result.winnerTeam) {
    batch.update(
      doc(db, "matches", params.matchId),
      completeMatchUpdate(result.winnerTeam, "checkmate")
    );
  } else {
    const postMoveEnd = evaluateMatchEnd(result.snapshot);
    if (postMoveEnd.ended && postMoveEnd.reason === "time_forfeit" && postMoveEnd.winnerTeam) {
      batch.update(
        doc(db, "matches", params.matchId),
        completeMatchUpdate(postMoveEnd.winnerTeam, "time_forfeit")
      );
    }
  }

  await batch.commit();

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

  return { ok: true };
}

/** Sync clocks and end the match when a physical-board clock hits zero. */
export async function submitTimeForfeit(matchId: string): Promise<void> {
  const ctx = await loadMatchContext(matchId);
  if (!ctx) return;

  const { match, boards } = ctx;
  if (match.status !== "active") return;

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
