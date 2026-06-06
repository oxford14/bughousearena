/**
 * Official Bughouse Chess rules engine.
 *
 * Structure:
 * - Board Alpha: White Alpha (T1) vs Black Alpha (T2)
 * - Board Bravo: White Bravo (T2) vs Black Bravo (T1)
 * - Partners: White Alpha ↔ Black Bravo, Black Alpha ↔ White Bravo
 */
import { Chess, type Color, type Move, type Square } from "chess.js";

export type PieceSymbol = "p" | "n" | "b" | "r" | "q";
export type BoardSeatId = "board-a" | "board-b" | "board-c" | "board-d";
export type PhysicalBoardId = "alpha" | "bravo";
export type PlayerColor = "w" | "b";
export type BoardPlayStatus = "active" | "stalemate" | "checkmate";

const DROP_PIECES: PieceSymbol[] = ["p", "n", "b", "r", "q"];

export interface SeatConfig {
  team: 1 | 2;
  partnerBoardId: BoardSeatId;
  physicalBoard: PhysicalBoardId;
  /** Fixed seat color on the physical board. */
  seatColor: PlayerColor;
  label: string;
}

export const SEAT_CONFIG: Record<BoardSeatId, SeatConfig> = {
  "board-a": {
    team: 1,
    partnerBoardId: "board-d",
    physicalBoard: "alpha",
    seatColor: "w",
    label: "White Alpha",
  },
  "board-c": {
    team: 2,
    partnerBoardId: "board-b",
    physicalBoard: "alpha",
    seatColor: "b",
    label: "Black Alpha",
  },
  "board-b": {
    team: 2,
    partnerBoardId: "board-c",
    physicalBoard: "bravo",
    seatColor: "w",
    label: "White Bravo",
  },
  "board-d": {
    team: 1,
    partnerBoardId: "board-a",
    physicalBoard: "bravo",
    seatColor: "b",
    label: "Black Bravo",
  },
};

export const PHYSICAL_BOARD_SEATS: Record<PhysicalBoardId, BoardSeatId[]> = {
  alpha: ["board-a", "board-c"],
  bravo: ["board-b", "board-d"],
};

export const BOARD_IDS = Object.keys(SEAT_CONFIG) as BoardSeatId[];

/** @deprecated Use SEAT_CONFIG */
export const BOARD_TEAM_MAP: Record<
  BoardSeatId,
  { team: 1 | 2; partner: BoardSeatId }
> = Object.fromEntries(
  BOARD_IDS.map((id) => [
    id,
    { team: SEAT_CONFIG[id].team, partner: SEAT_CONFIG[id].partnerBoardId },
  ])
) as Record<BoardSeatId, { team: 1 | 2; partner: BoardSeatId }>;

export type BoardId = BoardSeatId;

export interface PhysicalBoardState {
  id: PhysicalBoardId;
  fen: string;
  /** Squares occupied by promoted pawns (piece identity tracking). */
  promotedSquares: Record<string, boolean>;
  whiteClock: number;
  blackClock: number;
  /** Side whose clock is currently running; null when frozen or not started. */
  clockRunning: PlayerColor | null;
  /** Epoch ms when running clock was last synced to whiteClock/blackClock. */
  clockUpdatedAtMs: number;
  status: BoardPlayStatus;
}

export interface SeatState {
  boardId: BoardSeatId;
  playerUid: string;
  reserve: PieceSymbol[];
}

export interface BughouseSnapshot {
  physical: Record<PhysicalBoardId, PhysicalBoardState>;
  seats: Record<BoardSeatId, SeatState>;
}

export interface MoveAction {
  type: "move";
  seatId: BoardSeatId;
  move: string;
  promotion?: PieceSymbol;
}

export interface DropAction {
  type: "drop";
  seatId: BoardSeatId;
  piece: PieceSymbol;
  square: Square;
}

export type GameAction = MoveAction | DropAction;

export interface ActionResult {
  valid: boolean;
  error?: string;
  snapshot?: BughouseSnapshot;
  /** Piece type added to partner reserve after capture. */
  partnerReservePiece?: PieceSymbol;
  partnerSeatId?: BoardSeatId;
  matchEnded?: boolean;
  winnerTeam?: 1 | 2;
  physicalBoardFrozen?: PhysicalBoardId;
}

export function createBoard(fen?: string): Chess {
  return new Chess(fen);
}

export function getInitialFen(): string {
  return new Chess().fen();
}

export function getPhysicalBoard(seatId: BoardSeatId): PhysicalBoardId {
  return SEAT_CONFIG[seatId].physicalBoard;
}

/** User-facing label — only two physical boards exist (A and B). */
export function getPhysicalBoardLabel(physicalId: PhysicalBoardId): string {
  return physicalId === "alpha" ? "Board A" : "Board B";
}

export function getPhysicalBoardLabelForSeat(seatId: BoardSeatId): string {
  return getPhysicalBoardLabel(getPhysicalBoard(seatId));
}

export function getPartnerSeatId(seatId: BoardSeatId): BoardSeatId {
  return SEAT_CONFIG[seatId].partnerBoardId;
}

export function getSeatColor(seatId: BoardSeatId): PlayerColor {
  return SEAT_CONFIG[seatId].seatColor;
}

export function getMirrorSeats(seatId: BoardSeatId): BoardSeatId[] {
  const physical = getPhysicalBoard(seatId);
  return PHYSICAL_BOARD_SEATS[physical];
}

export function normalizeCaptured(captured: string[]): Record<PieceSymbol, number> {
  const counts: Record<PieceSymbol, number> = { p: 0, n: 0, b: 0, r: 0, q: 0 };
  for (const piece of captured) {
    if (DROP_PIECES.includes(piece as PieceSymbol)) {
      counts[piece as PieceSymbol] += 1;
    }
  }
  return counts;
}

export function canDropPiece(reserve: PieceSymbol[], piece: PieceSymbol): boolean {
  return reserve.includes(piece);
}

export function consumeCaptured(reserve: PieceSymbol[], piece: PieceSymbol): PieceSymbol[] {
  const idx = reserve.indexOf(piece);
  if (idx === -1) return reserve;
  return [...reserve.slice(0, idx), ...reserve.slice(idx + 1)];
}

export function addCaptured(reserve: PieceSymbol[], piece: PieceSymbol): PieceSymbol[] {
  return [...reserve, piece];
}

function cloneSnapshot(snapshot: BughouseSnapshot): BughouseSnapshot {
  return {
    physical: {
      alpha: { ...snapshot.physical.alpha, promotedSquares: { ...snapshot.physical.alpha.promotedSquares } },
      bravo: { ...snapshot.physical.bravo, promotedSquares: { ...snapshot.physical.bravo.promotedSquares } },
    },
    seats: Object.fromEntries(
      BOARD_IDS.map((id) => [id, { ...snapshot.seats[id], reserve: [...snapshot.seats[id].reserve] }])
    ) as Record<BoardSeatId, SeatState>,
  };
}

function updatePromotedSquares(
  promoted: Record<string, boolean>,
  move: Move
): Record<string, boolean> {
  const next = { ...promoted };
  if (move.promotion) {
    next[move.to] = true;
  }
  if (next[move.from]) {
    next[move.to] = true;
    delete next[move.from];
  }
  return next;
}

/** Promoted piece captured → teammate receives a pawn. */
export function reservePieceFromCapture(
  capturedType: string,
  captureSquare: Square,
  promotedSquares: Record<string, boolean>
): PieceSymbol | null {
  if (capturedType === "k") return null;
  const symbol = capturedType as PieceSymbol;
  if (!DROP_PIECES.includes(symbol)) return null;
  if (promotedSquares[captureSquare]) return "p";
  return symbol;
}

export function isValidDrop(
  board: Chess,
  piece: PieceSymbol,
  square: Square,
  turn: Color
): boolean {
  if (board.turn() !== turn) return false;
  if (board.get(square)) return false;

  const clone = new Chess(board.fen());
  clone.remove(square);
  clone.put({ type: piece, color: turn }, square);

  if (clone.isCheck()) return false;

  if (piece === "p") {
    const rank = square[1];
    if (rank === "1" || rank === "8") return false;
  }

  return true;
}

export function getValidDropSquares(
  fen: string,
  reserve: PieceSymbol[],
  seatColor: PlayerColor
): Square[] {
  const board = new Chess(fen);
  if (board.turn() !== seatColor) return [];

  const squares: Square[] = [];
  const uniquePieces = [...new Set(reserve)];
  for (const piece of uniquePieces) {
    if (!canDropPiece(reserve, piece)) continue;
    for (const file of "abcdefgh") {
      for (const rank of "12345678") {
        const sq = `${file}${rank}` as Square;
        if (isValidDrop(board, piece, sq, seatColor)) {
          squares.push(sq);
        }
      }
    }
  }
  return squares;
}

function hasAnyLegalDrop(
  fen: string,
  reserve: PieceSymbol[],
  seatColor: PlayerColor
): boolean {
  return getValidDropSquares(fen, reserve, seatColor).length > 0;
}

function getOpponentSeat(physicalId: PhysicalBoardId, moverColor: PlayerColor): BoardSeatId {
  const seats = PHYSICAL_BOARD_SEATS[physicalId];
  for (const seatId of seats) {
    if (SEAT_CONFIG[seatId].seatColor !== moverColor) return seatId;
  }
  return seats[0]!;
}

export function detectBoardStatus(
  fen: string,
  reserve: PieceSymbol[],
  sideToMove: PlayerColor,
  _promotedSquares: Record<string, boolean>
): BoardPlayStatus {
  const board = new Chess(fen);
  if (board.turn() !== sideToMove) {
    return "active";
  }
  if (board.isCheckmate()) return "checkmate";

  const hasMoves = board.moves().length > 0;
  const hasDrops = hasAnyLegalDrop(fen, reserve, sideToMove);

  if (!hasMoves && !hasDrops) {
    return board.isCheck() ? "checkmate" : "stalemate";
  }
  return "active";
}

/** Team that owns a color on a physical board. */
export function getTeamForColorOnBoard(
  physicalId: PhysicalBoardId,
  color: PlayerColor
): 1 | 2 {
  for (const seatId of PHYSICAL_BOARD_SEATS[physicalId]) {
    if (SEAT_CONFIG[seatId].seatColor === color) return SEAT_CONFIG[seatId].team;
  }
  throw new Error(`No ${color} seat on ${physicalId}`);
}

/** Side to move from FEN (whose clock is running). */
export function getSideToMoveFromFen(fen: string): PlayerColor {
  return fen.includes(" w ") ? "w" : "b";
}

/** Standard bughouse drop notation, e.g. N@f7 or Q@h6# */
export function formatDropNotation(piece: PieceSymbol, square: Square): string {
  const letter = piece.toUpperCase();
  return `${letter}@${square}`;
}

export function parseDropNotation(notation: string): { piece: PieceSymbol; square: Square } | null {
  const match = /^([PNBRQ])@([a-h][1-8])$/i.exec(notation.trim());
  if (!match) return null;
  return {
    piece: match[1]!.toLowerCase() as PieceSymbol,
    square: match[2] as Square,
  };
}

export function createInitialSnapshot(initialSeconds = 300): BughouseSnapshot {
  const fen = getInitialFen();
  const physical = (id: PhysicalBoardId): PhysicalBoardState => ({
    id,
    fen,
    promotedSquares: {},
    whiteClock: initialSeconds,
    blackClock: initialSeconds,
    clockRunning: null,
    clockUpdatedAtMs: 0,
    status: "active",
  });

  return {
    physical: { alpha: physical("alpha"), bravo: physical("bravo") },
    seats: Object.fromEntries(
      BOARD_IDS.map((boardId) => [
        boardId,
        { boardId, playerUid: "", reserve: [] as PieceSymbol[] },
      ])
    ) as Record<BoardSeatId, SeatState>,
  };
}

/** Returns losing team if any clock hit zero on either physical board. */
export function getTimeForfeitTeam(snapshot: BughouseSnapshot): 1 | 2 | null {
  for (const physicalId of ["alpha", "bravo"] as PhysicalBoardId[]) {
    const board = snapshot.physical[physicalId];
    if (board.whiteClock <= 0) {
      return getTeamForColorOnBoard(physicalId, "w");
    }
    if (board.blackClock <= 0) {
      return getTeamForColorOnBoard(physicalId, "b");
    }
  }
  return null;
}

export interface MatchEndState {
  ended: boolean;
  reason?: "checkmate" | "time_forfeit" | "stalemate_board";
  winnerTeam?: 1 | 2;
  frozenBoard?: PhysicalBoardId;
}

export function evaluateMatchEnd(snapshot: BughouseSnapshot): MatchEndState {
  const timeLoser = getTimeForfeitTeam(snapshot);
  if (timeLoser) {
    return {
      ended: true,
      reason: "time_forfeit",
      winnerTeam: timeLoser === 1 ? 2 : 1,
    };
  }

  for (const physicalId of ["alpha", "bravo"] as PhysicalBoardId[]) {
    const board = snapshot.physical[physicalId];
    if (board.status === "checkmate") {
      const sideToMove = getSideToMoveFromFen(board.fen);
      const loserTeam = getTeamForColorOnBoard(physicalId, sideToMove);
      return {
        ended: true,
        reason: "checkmate",
        winnerTeam: loserTeam === 1 ? 2 : 1,
      };
    }
  }

  return { ended: false };
}

/** Deduct elapsed time from the clock that is currently running. */
export function tickPhysicalClock(
  physical: PhysicalBoardState,
  nowMs = Date.now()
): PhysicalBoardState {
  if (physical.status !== "active" || physical.clockRunning == null) {
    return physical;
  }

  const updatedAt = physical.clockUpdatedAtMs;
  if (updatedAt == null || Number.isNaN(updatedAt)) {
    return physical;
  }
  const elapsed = Math.max(0, Math.floor((nowMs - updatedAt) / 1000));
  if (elapsed === 0) return physical;

  const next = { ...physical, clockUpdatedAtMs: nowMs };
  if (physical.clockRunning === "w") {
    next.whiteClock = Math.max(0, physical.whiteClock - elapsed);
  } else {
    next.blackClock = Math.max(0, physical.blackClock - elapsed);
  }
  return next;
}

export function tickAllPhysicalClocks(
  snapshot: BughouseSnapshot,
  nowMs = Date.now()
): BughouseSnapshot {
  const next = cloneSnapshot(snapshot);
  for (const id of ["alpha", "bravo"] as PhysicalBoardId[]) {
    next.physical[id] = tickPhysicalClock(next.physical[id], nowMs);
  }
  return next;
}

const PHYSICAL_BOARD_IDS: PhysicalBoardId[] = ["alpha", "bravo"];

/** True once any physical board has begun counting. */
export function matchClocksStarted(snapshot: BughouseSnapshot): boolean {
  return PHYSICAL_BOARD_IDS.some(
    (id) => snapshot.physical[id].clockRunning != null
  );
}

/** True when both physical boards have an active running clock side. */
export function allMatchClocksStarted(snapshot: BughouseSnapshot): boolean {
  return PHYSICAL_BOARD_IDS.every(
    (id) =>
      snapshot.physical[id].status !== "active" ||
      snapshot.physical[id].clockRunning != null
  );
}

function backfillIdlePhysicalBoard(
  board: PhysicalBoardState,
  nowMs: number,
  anchorMs: number
): PhysicalBoardState {
  const side = getSideToMoveFromFen(board.fen);
  const elapsed = Math.max(0, Math.floor((nowMs - anchorMs) / 1000));
  const next: PhysicalBoardState = {
    ...board,
    clockRunning: side,
    clockUpdatedAtMs: nowMs,
  };
  if (side === "w") {
    next.whiteClock = Math.max(0, board.whiteClock - elapsed);
  } else {
    next.blackClock = Math.max(0, board.blackClock - elapsed);
  }
  return next;
}

/**
 * Keep both physical boards in sync — on first move anywhere, start both;
 * repair legacy state where only one board was counting.
 */
export function ensureAllPhysicalClocksStarted(
  snapshot: BughouseSnapshot,
  nowMs = Date.now(),
  clocksStartedAtMs?: number | null
): BughouseSnapshot {
  if (allMatchClocksStarted(snapshot)) return snapshot;

  if (!matchClocksStarted(snapshot)) {
    return startMatchClocks(snapshot, nowMs);
  }

  const anchorFromBoards = Math.min(
    ...PHYSICAL_BOARD_IDS.map((id) => snapshot.physical[id].clockUpdatedAtMs).filter(
      (ms) => ms > 0
    )
  );
  const anchorMs =
    clocksStartedAtMs && clocksStartedAtMs > 0
      ? clocksStartedAtMs
      : Number.isFinite(anchorFromBoards) && anchorFromBoards > 0
        ? anchorFromBoards
        : nowMs;

  const next = cloneSnapshot(snapshot);
  for (const id of PHYSICAL_BOARD_IDS) {
    const board = next.physical[id];
    if (board.status !== "active" || board.clockRunning != null) continue;
    next.physical[id] = backfillIdlePhysicalBoard(board, nowMs, anchorMs);
  }
  return next;
}

/** Estimate when clocks began (for legacy matches missing clocksStartedAtMs). */
export function inferGlobalClockStartMs(
  snapshot: BughouseSnapshot,
  initialClockSec: number,
  nowMs = Date.now()
): number | null {
  for (const id of PHYSICAL_BOARD_IDS) {
    const ref = snapshot.physical[id];
    if (ref.clockRunning == null) continue;

    const whiteElapsed =
      ref.clockRunning === "w"
        ? initialClockSec - getEffectiveClock(ref, "w", nowMs)
        : initialClockSec - ref.whiteClock;

    if (whiteElapsed >= 0) {
      return nowMs - whiteElapsed * 1000;
    }
  }
  return null;
}

/** Both physical boards: White clocks start on the first move anywhere. */
export function startMatchClocks(
  snapshot: BughouseSnapshot,
  nowMs = Date.now()
): BughouseSnapshot {
  const next = cloneSnapshot(snapshot);
  for (const id of PHYSICAL_BOARD_IDS) {
    const board = next.physical[id];
    if (board.status !== "active") continue;
    next.physical[id] = {
      ...board,
      clockRunning: "w",
      clockUpdatedAtMs: nowMs,
    };
  }
  return next;
}

/** Live clock display including unsynced elapsed time. */
export function getEffectiveClock(
  physical: Pick<
    PhysicalBoardState,
    "whiteClock" | "blackClock" | "clockRunning" | "clockUpdatedAtMs" | "status"
  >,
  color: PlayerColor,
  nowMs = Date.now()
): number {
  const base = color === "w" ? physical.whiteClock : physical.blackClock;
  if (
    physical.status !== "active" ||
    physical.clockRunning !== color ||
    physical.clockUpdatedAtMs == null
  ) {
    return base;
  }
  const elapsed = Math.max(
    0,
    Math.floor((nowMs - physical.clockUpdatedAtMs) / 1000)
  );
  return Math.max(0, base - elapsed);
}

function finalizePhysicalClock(
  physical: PhysicalBoardState,
  nowMs: number,
  newFen: string,
  newStatus: BoardPlayStatus
): PhysicalBoardState {
  const ticked = tickPhysicalClock(physical, nowMs);
  return {
    ...ticked,
    fen: newFen,
    status: newStatus,
    clockRunning: newStatus === "active" ? getSideToMoveFromFen(newFen) : null,
    clockUpdatedAtMs: nowMs,
  };
}

function flipTurnInFen(fen: string): string {
  const parts = fen.split(" ");
  parts[1] = parts[1] === "w" ? "b" : "w";
  return parts.join(" ");
}

export function applyAction(
  snapshot: BughouseSnapshot,
  action: GameAction,
  nowMs = Date.now(),
  clocksStartedAtMs?: number | null
): ActionResult {
  let next = cloneSnapshot(snapshot);
  next = ensureAllPhysicalClocksStarted(next, nowMs, clocksStartedAtMs);

  const seatId = action.seatId;
  const seatConfig = SEAT_CONFIG[seatId];
  const physicalId = seatConfig.physicalBoard;
  let physical = tickPhysicalClock(next.physical[physicalId], nowMs);
  next.physical[physicalId] = physical;
  const seat = next.seats[seatId];

  if (physical.status !== "active") {
    return { valid: false, error: "This board is frozen" };
  }

  const chess = new Chess(physical.fen);
  if (chess.turn() !== seatConfig.seatColor) {
    return { valid: false, error: "Not your turn" };
  }

  let partnerReservePiece: PieceSymbol | undefined;
  const partnerSeatId = seatConfig.partnerBoardId;

  if (action.type === "move") {
    let move: Move | null = null;
    try {
      if (action.promotion) {
        move = chess.move({
          from: action.move.slice(0, 2),
          to: action.move.slice(2, 4),
          promotion: action.promotion,
        });
      } else {
        move = chess.move(action.move);
      }
    } catch {
      return { valid: false, error: "Illegal move" };
    }
    if (!move) return { valid: false, error: "Illegal move" };

    if (move.captured) {
      const piece = reservePieceFromCapture(
        move.captured,
        move.to,
        physical.promotedSquares
      );
      if (piece) {
        partnerReservePiece = piece;
        next.seats[partnerSeatId].reserve = addCaptured(
          next.seats[partnerSeatId].reserve,
          piece
        );
      }
    }

    physical.promotedSquares = updatePromotedSquares(physical.promotedSquares, move);
    physical.fen = chess.fen();
  } else {
    if (!canDropPiece(seat.reserve, action.piece)) {
      return { valid: false, error: "Piece not in reserve" };
    }
    if (!isValidDrop(chess, action.piece, action.square, seatConfig.seatColor)) {
      return { valid: false, error: "Illegal drop" };
    }

    chess.remove(action.square);
    chess.put({ type: action.piece, color: seatConfig.seatColor }, action.square);
    physical.fen = flipTurnInFen(chess.fen());
    next.seats[seatId].reserve = consumeCaptured(seat.reserve, action.piece);
  }

  const opponentSeatId = getOpponentSeat(physicalId, seatConfig.seatColor);
  const status = detectBoardStatus(
    physical.fen,
    next.seats[opponentSeatId].reserve,
    SEAT_CONFIG[opponentSeatId].seatColor,
    physical.promotedSquares
  );
  next.physical[physicalId] = finalizePhysicalClock(
    physical,
    nowMs,
    physical.fen,
    status
  );

  const result: ActionResult = {
    valid: true,
    snapshot: next,
    partnerReservePiece,
    partnerSeatId: partnerReservePiece ? partnerSeatId : undefined,
  };

  const endState = evaluateMatchEnd(next);
  if (endState.ended && endState.reason === "checkmate" && endState.winnerTeam) {
    result.matchEnded = true;
    result.winnerTeam = endState.winnerTeam;
  } else if (status === "stalemate") {
    result.physicalBoardFrozen = physicalId;
  }

  return result;
}

export function validateMove(
  fen: string,
  move: string,
  seatColor: PlayerColor,
  promotion?: PieceSymbol
): { valid: boolean; error?: string; fen?: string; capturedPiece?: PieceSymbol } {
  const board = new Chess(fen);
  if (board.turn() !== seatColor) {
    return { valid: false, error: "Not your turn" };
  }

  let result: Move | null = null;
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
    return { valid: false, error: "Illegal move" };
  }

  if (!result) return { valid: false, error: "Illegal move" };

  return {
    valid: true,
    fen: board.fen(),
    capturedPiece: result.captured as PieceSymbol | undefined,
  };
}

export function validateDrop(
  fen: string,
  piece: PieceSymbol,
  square: Square,
  seatColor: PlayerColor,
  reserve: PieceSymbol[]
): { valid: boolean; error?: string; fen?: string } {
  if (!canDropPiece(reserve, piece)) {
    return { valid: false, error: "Piece not in reserve" };
  }

  const board = new Chess(fen);
  if (board.turn() !== seatColor) {
    return { valid: false, error: "Not your turn" };
  }

  if (!isValidDrop(board, piece, square, seatColor)) {
    return { valid: false, error: "Illegal drop" };
  }

  board.remove(square);
  board.put({ type: piece, color: seatColor }, square);

  return { valid: true, fen: flipTurnInFen(board.fen()) };
}

export function snapshotFromBoardDocs(
  boards: Array<{
    id: string;
    fen: string;
    captured: string[];
    playerUid: string;
    promotedSquares?: string[];
    boardStatus?: BoardPlayStatus;
    whiteClock?: number;
    blackClock?: number;
    clockRunning?: PlayerColor | null;
    clockUpdatedAtMs?: number;
  }>
): BughouseSnapshot {
  const byId = Object.fromEntries(boards.map((b) => [b.id, b]));

  const buildPhysical = (id: PhysicalBoardId): PhysicalBoardState => {
    const seats = PHYSICAL_BOARD_SEATS[id];
    const primary = byId[seats[0]!]!;
    const promotedSquares: Record<string, boolean> = {};
    for (const sq of primary.promotedSquares ?? []) {
      promotedSquares[sq] = true;
    }
    const status = primary.boardStatus ?? "active";
    const fen = primary.fen;
    return {
      id,
      fen,
      promotedSquares,
      whiteClock: primary.whiteClock ?? 300,
      blackClock: primary.blackClock ?? 300,
      // Clock stays paused (null) until the first move anywhere in the match.
      clockRunning: primary.clockRunning ?? null,
      clockUpdatedAtMs: primary.clockUpdatedAtMs ?? 0,
      status,
    };
  };

  return {
    physical: {
      alpha: buildPhysical("alpha"),
      bravo: buildPhysical("bravo"),
    },
    seats: Object.fromEntries(
      BOARD_IDS.map((boardId) => [
        boardId,
        {
          boardId,
          playerUid: byId[boardId]?.playerUid ?? "",
          reserve: (byId[boardId]?.captured ?? []) as PieceSymbol[],
        },
      ])
    ) as Record<BoardSeatId, SeatState>,
  };
}

export function getWinnerTeamFromCheckmate(
  boards: { team: 1 | 2; boardStatus?: BoardPlayStatus; id: string; fen?: string }[]
): 1 | 2 | null {
  for (const board of boards) {
    if (board.boardStatus === "checkmate" && board.fen) {
      const physicalId = getPhysicalBoard(board.id as BoardSeatId);
      const sideToMove = getSideToMoveFromFen(board.fen);
      const loserTeam = getTeamForColorOnBoard(physicalId, sideToMove);
      return loserTeam === 1 ? 2 : 1;
    }
  }
  return null;
}

// Re-export legacy helpers used across the app
export function applyMove(board: Chess, move: string | Move): Move | null {
  try {
    return board.move(move);
  } catch {
    return null;
  }
}

export function applyDrop(board: Chess, piece: PieceSymbol, square: Square): boolean {
  if (!isValidDrop(board, piece, square, board.turn())) return false;
  board.remove(square);
  board.put({ type: piece, color: board.turn() }, square);
  return true;
}

export function getCapturedPieceType(move: Move): PieceSymbol | null {
  if (!move.captured) return null;
  return move.captured as PieceSymbol;
}

export function isGameOver(board: Chess): boolean {
  return board.isGameOver();
}

export function getWinnerTeamFromBoards(
  boards: { team: 1 | 2; isGameOver: boolean; fen: string; boardStatus?: BoardPlayStatus }[]
): 1 | 2 | null {
  for (const board of boards) {
    if (board.boardStatus === "checkmate") {
      return board.team === 1 ? 2 : 1;
    }
    const chess = new Chess(board.fen);
    if (chess.isCheckmate()) {
      return board.team === 1 ? 2 : 1;
    }
  }
  return null;
}

export { DROP_PIECES };
