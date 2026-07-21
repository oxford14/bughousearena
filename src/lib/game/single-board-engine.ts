/**
 * Standard chess + Crazyhouse (own-pocket drops) + Atomic Chess on a single board.
 */

import { Chess, type Square } from "chess.js";
import type { BoardDocument, ChessGameType, MatchEndReason } from "@/types/firestore";

export type PieceSymbol = "p" | "n" | "b" | "r" | "q";
export type PlayerColor = "w" | "b";

export const SINGLE_BOARD_ID = "main";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export function getStandardInitialFen(): string {
  return START_FEN;
}

export interface SingleBoardApplyResult {
  ok: boolean;
  error?: string;
  board?: BoardDocument;
  matchEnded?: boolean;
  winnerTeam?: 1 | 2;
  endReason?: MatchEndReason;
}

function colorToTeam(color: PlayerColor): 1 | 2 {
  return color === "w" ? 1 : 2;
}

function oppositeColor(color: PlayerColor): PlayerColor {
  return color === "w" ? "b" : "w";
}

function removeOneFromPocket(pocket: string[], piece: string): string[] | null {
  const idx = pocket.findIndex((p) => p.toLowerCase() === piece.toLowerCase());
  if (idx < 0) return null;
  return [...pocket.slice(0, idx), ...pocket.slice(idx + 1)];
}

function addCaptureToPocket(
  pocket: string[],
  capturedType: string
): string[] {
  const t = capturedType.toLowerCase();
  if (t === "k") return pocket;
  return [...pocket, t];
}

/** Parse "e2e4" or "e7e8q" style move. */
export function parseUciMove(move: string): {
  from: Square;
  to: Square;
  promotion?: PieceSymbol;
} | null {
  const m = move.trim().toLowerCase();
  if (m.length < 4) return null;
  const from = m.slice(0, 2) as Square;
  const to = m.slice(2, 4) as Square;
  const promo = m[4] as PieceSymbol | undefined;
  return { from, to, promotion: promo };
}

function findKingSquare(chess: Chess, color: PlayerColor): Square | null {
  const board = chess.board();
  const files = "abcdefgh";
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row]?.[col];
      if (piece?.type === "k" && piece.color === color) {
        return `${files[col]}${8 - row}` as Square;
      }
    }
  }
  return null;
}

function areKingsAdjacent(chess: Chess): boolean {
  const white = findKingSquare(chess, "w");
  const black = findKingSquare(chess, "b");
  if (!white || !black) return false;
  const wf = white.charCodeAt(0) - 97;
  const wr = Number(white[1]) - 1;
  const bf = black.charCodeAt(0) - 97;
  const br = Number(black[1]) - 1;
  return Math.max(Math.abs(wf - bf), Math.abs(wr - br)) === 1;
}

/** Explosion centered on the capture landing square (Lichess / FICS atomic). */
function applyExplosion(chess: Chess, center: Square): void {
  chess.remove(center);
  const file = center.charCodeAt(0) - 97;
  const rank = Number(center[1]) - 1;
  for (let df = -1; df <= 1; df++) {
    for (let dr = -1; dr <= 1; dr++) {
      if (df === 0 && dr === 0) continue;
      const f = file + df;
      const r = rank + dr;
      if (f < 0 || f > 7 || r < 0 || r > 7) continue;
      const sq = `${String.fromCharCode(97 + f)}${r + 1}` as Square;
      const piece = chess.get(sq);
      if (piece && piece.type !== "p") {
        chess.remove(sq);
      }
    }
  }
}

function withTurn(fen: string, turn: PlayerColor): string {
  const parts = fen.split(" ");
  parts[1] = turn;
  return parts.join(" ");
}

/**
 * True if `attacker` has a non-suicidal capture (or king capture threat) that
 * removes `victim`'s king. Used for atomic check detection.
 */
function canExplodeKing(
  fen: string,
  attacker: PlayerColor,
  victim: PlayerColor
): boolean {
  let chess: Chess;
  try {
    chess = new Chess(withTurn(fen, attacker));
  } catch {
    return false;
  }

  const victimKing = findKingSquare(chess, victim);
  if (!victimKing) return true;
  if (areKingsAdjacent(chess)) return false;

  // Direct attack on the king ≡ capturing it, which explodes the king.
  if (chess.isAttacked(victimKing, attacker)) return true;

  const moves = chess.moves({ verbose: true });
  for (const m of moves) {
    const isCapture = Boolean(m.captured) || m.flags.includes("e");
    if (!isCapture) continue;
    if (m.piece === "k") continue;

    const test = new Chess(chess.fen());
    const result = test.move({
      from: m.from,
      to: m.to,
      promotion: (m.promotion as PieceSymbol | undefined) ?? "q",
    });
    if (!result) continue;
    applyExplosion(test, m.to as Square);
    if (!findKingSquare(test, attacker)) continue;
    if (!findKingSquare(test, victim)) return true;
  }
  return false;
}

export function isInAtomicCheck(fen: string, color: PlayerColor): boolean {
  let chess: Chess;
  try {
    chess = new Chess(fen);
  } catch {
    return false;
  }
  if (!findKingSquare(chess, color)) return true;
  if (areKingsAdjacent(chess)) return false;
  return canExplodeKing(fen, oppositeColor(color), color);
}

export function validateStandardMove(
  fen: string,
  move: string,
  seatColor: PlayerColor,
  promotion?: PieceSymbol
): { valid: boolean; error?: string; fen?: string; capturedPiece?: PieceSymbol } {
  try {
    const chess = new Chess(fen);
    if (chess.turn() !== seatColor) {
      return { valid: false, error: "Not your turn." };
    }
    const parsed = parseUciMove(move);
    if (!parsed) return { valid: false, error: "Invalid move." };
    const result = chess.move({
      from: parsed.from,
      to: parsed.to,
      promotion: promotion ?? parsed.promotion ?? "q",
    });
    if (!result) return { valid: false, error: "Illegal move." };
    return {
      valid: true,
      fen: chess.fen(),
      capturedPiece: result.captured as PieceSymbol | undefined,
    };
  } catch {
    return { valid: false, error: "Illegal move." };
  }
}

export function validateAtomicMove(
  fen: string,
  move: string,
  seatColor: PlayerColor,
  promotion?: PieceSymbol
): {
  valid: boolean;
  error?: string;
  fen?: string;
  capturedPiece?: PieceSymbol;
  explodedOpponentKing?: boolean;
} {
  try {
    const chess = new Chess(fen);
    if (chess.turn() !== seatColor) {
      return { valid: false, error: "Not your turn." };
    }
    const parsed = parseUciMove(move);
    if (!parsed) return { valid: false, error: "Invalid move." };

    const moving = chess.get(parsed.from);
    if (!moving || moving.color !== seatColor) {
      return { valid: false, error: "Illegal move." };
    }

    const target = chess.get(parsed.to);
    const epSquare = chess.fen().split(" ")[3];
    const isEp =
      moving.type === "p" &&
      !target &&
      epSquare != null &&
      epSquare !== "-" &&
      parsed.to === epSquare;
    const isCapture = Boolean(target) || isEp;

    // Kings cannot capture in atomic (self-explosion).
    if (moving.type === "k" && isCapture) {
      return { valid: false, error: "King cannot capture in Atomic." };
    }

    const result = chess.move({
      from: parsed.from,
      to: parsed.to,
      promotion: promotion ?? parsed.promotion ?? "q",
    });
    if (!result) return { valid: false, error: "Illegal move." };

    const capturedPiece = result.captured as PieceSymbol | undefined;
    if (result.captured || result.flags.includes("e")) {
      applyExplosion(chess, parsed.to);
    }

    const ownKing = findKingSquare(chess, seatColor);
    const oppKing = findKingSquare(chess, oppositeColor(seatColor));

    if (!ownKing && !oppKing) {
      return { valid: false, error: "Illegal move — both kings explode." };
    }
    if (!ownKing) {
      return { valid: false, error: "Illegal move — would explode your king." };
    }

    const explodedOpponentKing = !oppKing;
    if (!explodedOpponentKing && isInAtomicCheck(chess.fen(), seatColor)) {
      return { valid: false, error: "Illegal move — leaves king in check." };
    }

    return {
      valid: true,
      fen: chess.fen(),
      capturedPiece,
      explodedOpponentKing,
    };
  } catch {
    return { valid: false, error: "Illegal move." };
  }
}

/** Destination squares for atomic move hints. */
export function getAtomicValidMoveSquares(
  fen: string,
  fromSquare: Square,
  seatColor: PlayerColor
): Square[] {
  let chess: Chess;
  try {
    chess = new Chess(fen);
  } catch {
    return [];
  }
  if (chess.turn() !== seatColor) return [];
  const piece = chess.get(fromSquare);
  if (!piece || piece.color !== seatColor) return [];

  const targets: Square[] = [];
  for (const m of chess.moves({ square: fromSquare, verbose: true })) {
    const promo = (m.promotion as PieceSymbol | undefined) ?? undefined;
    const uci = `${m.from}${m.to}${promo ?? ""}`;
    const validated = validateAtomicMove(fen, uci, seatColor, promo);
    if (validated.valid) targets.push(m.to as Square);
  }
  return targets;
}

export function listAtomicLegalUciMoves(
  fen: string,
  seatColor: PlayerColor
): string[] {
  let chess: Chess;
  try {
    chess = new Chess(fen);
  } catch {
    return [];
  }
  if (chess.turn() !== seatColor) return [];
  const out: string[] = [];
  for (const m of chess.moves({ verbose: true })) {
    const promo = (m.promotion as PieceSymbol | undefined) ?? undefined;
    const uci = `${m.from}${m.to}${promo ?? ""}`;
    if (validateAtomicMove(fen, uci, seatColor, promo).valid) {
      out.push(uci);
    }
  }
  return out;
}

export function validateCrazyhouseDrop(
  fen: string,
  piece: PieceSymbol,
  to: Square,
  seatColor: PlayerColor,
  pocket: string[]
): { valid: boolean; error?: string; fen?: string } {
  if (!pocket.some((p) => p.toLowerCase() === piece)) {
    return { valid: false, error: "Piece not in pocket." };
  }
  if (piece === "p") {
    const rank = to[1];
    if (rank === "1" || rank === "8") {
      return { valid: false, error: "Cannot drop pawn on back rank." };
    }
  }
  try {
    const chess = new Chess(fen);
    if (chess.turn() !== seatColor) {
      return { valid: false, error: "Not your turn." };
    }
    if (chess.get(to)) {
      return { valid: false, error: "Square occupied." };
    }
    const test = new Chess(fen);
    if (test.get(to)) return { valid: false, error: "Square occupied." };
    const placed = test.put({ type: piece, color: seatColor }, to);
    if (!placed) return { valid: false, error: "Illegal drop." };
    const fenAfter = test.fen();
    const parts = fenAfter.split(" ");
    parts[1] = seatColor === "w" ? "b" : "w";
    parts[3] = "-";
    const switched = parts.join(" ");
    try {
      const checkOwn = new Chess(fen);
      checkOwn.put({ type: piece, color: seatColor }, to);
      if (checkOwn.isCheck()) {
        return { valid: false, error: "Drop leaves king in check." };
      }
    } catch {
      return { valid: false, error: "Illegal drop." };
    }
    return { valid: true, fen: switched };
  } catch {
    return { valid: false, error: "Illegal drop." };
  }
}

export function getCrazyhouseDropSquares(
  fen: string,
  piece: PieceSymbol,
  seatColor: PlayerColor,
  pocket: string[]
): Square[] {
  const files = "abcdefgh";
  const ranks = "12345678";
  const out: Square[] = [];
  for (const f of files) {
    for (const r of ranks) {
      const sq = `${f}${r}` as Square;
      const result = validateCrazyhouseDrop(fen, piece, sq, seatColor, pocket);
      if (result.valid) out.push(sq);
    }
  }
  return out;
}

function evaluateEnd(
  chess: Chess,
  lastMoverColor: PlayerColor,
  opts?: { explodedOpponentKing?: boolean; gameType?: ChessGameType }
): { ended: boolean; winnerTeam?: 1 | 2; endReason?: MatchEndReason } {
  if (opts?.explodedOpponentKing) {
    return {
      ended: true,
      winnerTeam: colorToTeam(lastMoverColor),
      endReason: "explosion",
    };
  }

  if (opts?.gameType === "atomic") {
    const sideToMove = chess.turn() as PlayerColor;
    const legal = listAtomicLegalUciMoves(chess.fen(), sideToMove);
    if (legal.length === 0) {
      if (isInAtomicCheck(chess.fen(), sideToMove)) {
        return {
          ended: true,
          winnerTeam: colorToTeam(lastMoverColor),
          endReason: "checkmate",
        };
      }
      return { ended: true };
    }
    return { ended: false };
  }

  if (chess.isCheckmate()) {
    return {
      ended: true,
      winnerTeam: colorToTeam(lastMoverColor),
      endReason: "checkmate",
    };
  }
  if (chess.isDraw() || chess.isStalemate() || chess.isInsufficientMaterial()) {
    return { ended: true };
  }
  return { ended: false };
}

function tickClocks(
  board: BoardDocument,
  nowMs: number,
  moverColor: PlayerColor
): Partial<BoardDocument> {
  const last = board.clockUpdatedAtMs ?? nowMs;
  const elapsed = Math.max(0, (nowMs - last) / 1000);
  let whiteClock = board.whiteClock ?? 300;
  let blackClock = board.blackClock ?? 300;
  const running = board.clockRunning;

  if (running === "w") whiteClock = Math.max(0, whiteClock - elapsed);
  if (running === "b") blackClock = Math.max(0, blackClock - elapsed);

  return {
    whiteClock: Math.floor(whiteClock),
    blackClock: Math.floor(blackClock),
    clockRunning: moverColor === "w" ? "b" : "w",
    clockUpdatedAtMs: nowMs,
  };
}

export function applySingleBoardMove(params: {
  board: BoardDocument;
  gameType: ChessGameType;
  playerId: string;
  playerColor: PlayerColor;
  move: string;
  promotion?: PieceSymbol;
  nowMs?: number;
}): SingleBoardApplyResult {
  const { board, gameType, playerId, playerColor, move, promotion } = params;
  const nowMs = params.nowMs ?? Date.now();

  if (board.playerUid !== playerId && board.id === SINGLE_BOARD_ID) {
    // Allow match.players mapping: ownership checked by caller
  }

  if (gameType === "bughouse") {
    return { ok: false, error: "Wrong engine for bughouse." };
  }

  const chessBefore = new Chess(board.fen);
  if (chessBefore.turn() !== playerColor) {
    return { ok: false, error: "Not your turn." };
  }

  const clocks = tickClocks(board, nowMs, playerColor);
  if ((clocks.whiteClock ?? 0) <= 0) {
    return {
      ok: true,
      matchEnded: true,
      winnerTeam: 2,
      endReason: "time_forfeit",
      board: {
        ...board,
        ...clocks,
        whiteClock: 0,
        isGameOver: true,
        boardStatus: "checkmate",
      },
    };
  }
  if ((clocks.blackClock ?? 0) <= 0) {
    return {
      ok: true,
      matchEnded: true,
      winnerTeam: 1,
      endReason: "time_forfeit",
      board: {
        ...board,
        ...clocks,
        blackClock: 0,
        isGameOver: true,
        boardStatus: "checkmate",
      },
    };
  }

  const isAtomic = gameType === "atomic";
  const validated = isAtomic
    ? validateAtomicMove(board.fen, move, playerColor, promotion)
    : validateStandardMove(board.fen, move, playerColor, promotion);
  if (!validated.valid || !validated.fen) {
    return { ok: false, error: validated.error ?? "Illegal move." };
  }

  let pocket = [...(board.captured ?? [])];
  if (gameType === "crazyhouse" && validated.capturedPiece) {
    pocket = addCaptureToPocket(pocket, validated.capturedPiece);
  }

  const explodedOpponentKing =
    isAtomic && "explodedOpponentKing" in validated
      ? Boolean(validated.explodedOpponentKing)
      : false;

  // chess.js cannot load a FEN with a missing king after an atomic explosion win.
  if (explodedOpponentKing) {
    const next: BoardDocument = {
      ...board,
      fen: validated.fen,
      captured: [],
      turn: oppositeColor(playerColor),
      lastMove: move,
      isCheck: false,
      isGameOver: true,
      boardStatus: "checkmate",
      ...clocks,
      clockRunning: null,
    };
    return {
      ok: true,
      board: next,
      matchEnded: true,
      winnerTeam: colorToTeam(playerColor),
      endReason: "explosion",
    };
  }

  const chess = new Chess(validated.fen);
  const end = evaluateEnd(chess, playerColor, {
    explodedOpponentKing: false,
    gameType,
  });

  const inCheck = isAtomic
    ? isInAtomicCheck(validated.fen, chess.turn() as PlayerColor)
    : chess.isCheck();

  const next: BoardDocument = {
    ...board,
    fen: validated.fen,
    captured: gameType === "crazyhouse" ? pocket : [],
    turn: chess.turn(),
    lastMove: move,
    isCheck: inCheck,
    isGameOver: end.ended,
    boardStatus:
      end.endReason === "checkmate" || end.endReason === "explosion"
        ? "checkmate"
        : end.ended && !end.winnerTeam
          ? "stalemate"
          : "active",
    ...clocks,
    clockRunning: end.ended ? null : clocks.clockRunning,
  };

  return {
    ok: true,
    board: next,
    matchEnded: end.ended,
    winnerTeam: end.winnerTeam,
    endReason: end.endReason,
  };
}

export function applySingleBoardDrop(params: {
  board: BoardDocument;
  playerId: string;
  playerColor: PlayerColor;
  piece: PieceSymbol;
  to: Square;
  nowMs?: number;
}): SingleBoardApplyResult {
  const { board, playerColor, piece, to } = params;
  const nowMs = params.nowMs ?? Date.now();
  const pocket = board.captured ?? [];

  const clocks = tickClocks(board, nowMs, playerColor);
  if ((clocks.whiteClock ?? 0) <= 0) {
    return {
      ok: true,
      matchEnded: true,
      winnerTeam: 2,
      endReason: "time_forfeit",
      board: { ...board, ...clocks, whiteClock: 0, isGameOver: true },
    };
  }
  if ((clocks.blackClock ?? 0) <= 0) {
    return {
      ok: true,
      matchEnded: true,
      winnerTeam: 1,
      endReason: "time_forfeit",
      board: { ...board, ...clocks, blackClock: 0, isGameOver: true },
    };
  }

  const validated = validateCrazyhouseDrop(
    board.fen,
    piece,
    to,
    playerColor,
    pocket
  );
  if (!validated.valid || !validated.fen) {
    return { ok: false, error: validated.error ?? "Illegal drop." };
  }

  const nextPocket = removeOneFromPocket(pocket, piece);
  if (!nextPocket) return { ok: false, error: "Piece not in pocket." };

  const chess = new Chess(validated.fen);
  const end = evaluateEnd(chess, playerColor);

  const next: BoardDocument = {
    ...board,
    fen: validated.fen,
    captured: nextPocket,
    turn: chess.turn(),
    lastMove: `${piece}@${to}`,
    isCheck: chess.isCheck(),
    isGameOver: end.ended,
    boardStatus: chess.isCheckmate()
      ? "checkmate"
      : chess.isStalemate()
        ? "stalemate"
        : "active",
    ...clocks,
    clockRunning: end.ended ? null : clocks.clockRunning,
  };

  return {
    ok: true,
    board: next,
    matchEnded: end.ended,
    winnerTeam: end.winnerTeam,
    endReason: end.endReason,
  };
}

export function checkSingleBoardTimeForfeit(
  board: BoardDocument,
  nowMs = Date.now()
): SingleBoardApplyResult | null {
  const last = board.clockUpdatedAtMs ?? nowMs;
  const elapsed = Math.max(0, (nowMs - last) / 1000);
  let whiteClock = board.whiteClock ?? 300;
  let blackClock = board.blackClock ?? 300;
  const running = board.clockRunning;
  if (running === "w") whiteClock -= elapsed;
  if (running === "b") blackClock -= elapsed;

  if (whiteClock <= 0) {
    return {
      ok: true,
      matchEnded: true,
      winnerTeam: 2,
      endReason: "time_forfeit",
      board: {
        ...board,
        whiteClock: 0,
        blackClock: Math.floor(Math.max(0, blackClock)),
        clockRunning: null,
        clockUpdatedAtMs: nowMs,
        isGameOver: true,
      },
    };
  }
  if (blackClock <= 0) {
    return {
      ok: true,
      matchEnded: true,
      winnerTeam: 1,
      endReason: "time_forfeit",
      board: {
        ...board,
        whiteClock: Math.floor(Math.max(0, whiteClock)),
        blackClock: 0,
        clockRunning: null,
        clockUpdatedAtMs: nowMs,
        isGameOver: true,
      },
    };
  }
  return null;
}
