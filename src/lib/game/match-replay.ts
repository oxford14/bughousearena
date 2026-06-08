import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
} from "firebase/firestore";
import type { Square } from "chess.js";
import { getFirebaseDb } from "@/lib/firebase/config";
import { createInitialBoards } from "@/lib/game/board-state";
import {
  applyAction,
  BOARD_IDS,
  getPhysicalBoard,
  getPhysicalBoardLabelForSeat,
  snapshotFromBoardDocs,
  type BoardSeatId,
  type BughouseSnapshot,
  type GameAction,
  type PieceSymbol,
} from "@/lib/game/bughouse-engine";
import { matchTimeControlSeconds } from "@/lib/game/time-control";
import type {
  BoardDocument,
  MatchDocument,
  MatchPlayer,
  MoveDocument,
} from "@/types/firestore";

export interface ReplayFrame {
  index: number;
  label: string;
  boards: BoardDocument[];
  move: MoveDocument | null;
}

function parseReplayAction(
  boardId: BoardSeatId,
  move: string
): GameAction | null {
  if (move === "partner-sync") return null;
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
  return { type: "move", seatId: boardId, move };
}

function snapshotToBoardDocs(
  snapshot: BughouseSnapshot,
  template: BoardDocument[],
  actingSeatId?: BoardSeatId,
  lastMove?: string
): BoardDocument[] {
  return template.map((board) => {
    const seatId = board.id as BoardSeatId;
    const physicalId = getPhysicalBoard(seatId);
    const physical = snapshot.physical[physicalId];
    const seat = snapshot.seats[seatId];
    return {
      ...board,
      fen: physical.fen,
      captured: [...seat.reserve],
      turn: physical.fen.includes(" w ") ? "w" : "b",
      boardStatus: physical.status,
      lastMove: actingSeatId === seatId && lastMove ? lastMove : board.lastMove,
      whiteClock: physical.whiteClock,
      blackClock: physical.blackClock,
      clockRunning: physical.clockRunning,
      clockUpdatedAtMs: physical.clockUpdatedAtMs,
      isGameOver: physical.status !== "active",
    };
  });
}

export function formatReplayMoveLabel(
  move: MoveDocument,
  players: MatchPlayer[]
): string {
  const player =
    players.find((p) => p.uid === move.playerId) ??
    players.find((p) => p.boardId === move.boardId);
  const name = player?.displayName ?? "Player";
  const boardLabel = getPhysicalBoardLabelForSeat(move.boardId as BoardSeatId);

  if (move.move.startsWith("drop:") || move.move.includes("@")) {
    const raw = move.move.startsWith("drop:") ? move.move.slice(5) : move.move;
    const [piece, square] = raw.split("@");
    return `${name} dropped ${piece?.toUpperCase()} on ${square} · ${boardLabel}`;
  }

  const from = move.move.slice(0, 2);
  const to = move.move.slice(2, 4);
  return `${name} ${from}→${to} · ${boardLabel}`;
}

export async function fetchMatchMoves(matchId: string): Promise<MoveDocument[]> {
  const snap = await getDocs(
    query(
      collection(getFirebaseDb(), "matches", matchId, "moves"),
      orderBy("createdAt", "asc"),
      limit(500)
    )
  );

  return snap.docs.map(
    (docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as MoveDocument
  );
}

export function buildReplayFrames(
  match: MatchDocument,
  moves: MoveDocument[]
): ReplayFrame[] {
  const initialBoards = createInitialBoards(
    match.players,
    matchTimeControlSeconds(match)
  );
  let snapshot = snapshotFromBoardDocs(
    initialBoards.map((b) => ({
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

  const template = initialBoards.map((b) => ({ ...b }));
  const frames: ReplayFrame[] = [
    {
      index: 0,
      label: "Starting position",
      boards: template.map((b) => ({ ...b })),
      move: null,
    },
  ];

  const startedAtMs = match.startedAt?.toMillis?.() ?? Date.now();
  const clocksAnchor = match.clocksStartedAtMs ?? startedAtMs;
  let stepMs = startedAtMs;

  for (const move of moves) {
    const seatId = move.boardId as BoardSeatId;
    if (!BOARD_IDS.includes(seatId)) continue;

    const action = parseReplayAction(seatId, move.move);
    if (!action) continue;

    stepMs += 1000;
    const result = applyAction(snapshot, action, stepMs, clocksAnchor);
    if (!result.valid || !result.snapshot) continue;

    snapshot = result.snapshot;
    const boards = snapshotToBoardDocs(
      snapshot,
      template,
      seatId,
      move.move
    );

    frames.push({
      index: frames.length,
      label: formatReplayMoveLabel(move, match.players),
      boards,
      move,
    });
  }

  return frames;
}
