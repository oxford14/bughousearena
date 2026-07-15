import type { PieceSymbol } from "./bughouse-engine";

const PIECE_CHARS: Record<string, string> = {
  p: "p",
  n: "n",
  b: "b",
  r: "r",
  q: "q",
  k: "k",
};

/** Build a crazyhouse FEN pocket suffix for the side to move. */
export function buildCrazyhousePocket(
  captured: string[],
  seatColor: "w" | "b"
): string {
  if (captured.length === 0) return "";
  const letters = captured
    .filter((p) => p !== "k")
    .map((p) => {
      const ch = PIECE_CHARS[p.toLowerCase()] ?? p.toLowerCase();
      return seatColor === "w" ? ch.toUpperCase() : ch.toLowerCase();
    })
    .sort((a, b) => a.localeCompare(b));
  return `[${letters.join("")}]`;
}

/** Mark promoted squares with the crazyhouse `~` suffix in the placement field. */
export function markPromotedSquares(
  placement: string,
  promotedSquares: string[]
): string {
  if (promotedSquares.length === 0) return placement;

  const promoted = new Set(promotedSquares);
  const ranks = placement.split("/");
  const files = "abcdefgh";

  return ranks
    .map((rank, rankIndex) => {
      const rankNum = 8 - rankIndex;
      let fileIndex = 0;
      let out = "";

      for (const ch of rank) {
        if (ch >= "1" && ch <= "8") {
          fileIndex += Number(ch);
          out += ch;
          continue;
        }

        const square = `${files[fileIndex]!}${rankNum}`;
        fileIndex += 1;
        if (promoted.has(square)) {
          out += `${ch}~`;
        } else {
          out += ch;
        }
      }

      return out;
    })
    .join("/");
}

/**
 * Convert a standard board FEN + reserve into a crazyhouse FEN for Fairy-Stockfish.
 */
export function buildCrazyhouseFen(
  fen: string,
  captured: string[],
  promotedSquares: string[] = []
): string {
  const parts = fen.trim().split(/\s+/);
  if (parts.length < 4) {
    throw new Error(`Invalid FEN: ${fen}`);
  }

  const [placement, active, castling, enPassant] = parts;
  const turn = active === "b" ? "b" : "w";
  const marked = markPromotedSquares(placement, promotedSquares);
  const pocket = buildCrazyhousePocket(captured, turn);
  const halfmove = parts[4] ?? "0";
  const fullmove = parts[5] ?? "1";

  return `${marked}${pocket} ${turn} ${castling} ${enPassant} ${halfmove} ${fullmove}`;
}

export interface ParsedEngineMove {
  /** Regular move (e2e4) or drop (drop:n@f3) for submitBotMove. */
  move: string;
  promotion?: PieceSymbol;
}

/** Parse Fairy-Stockfish bestmove into app move notation. */
export function parseEngineBestMove(raw: string): ParsedEngineMove | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "(none)") return null;

  const dropMatch = /^([PNBRQK])@([a-h][1-8])$/i.exec(trimmed);
  if (dropMatch) {
    const piece = dropMatch[1]!.toLowerCase() as PieceSymbol;
    const square = dropMatch[2]!;
    return { move: `drop:${piece}@${square}` };
  }

  const moveMatch = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/i.exec(trimmed);
  if (moveMatch) {
    const from = moveMatch[1]!;
    const to = moveMatch[2]!;
    const result: ParsedEngineMove = { move: `${from}${to}` };
    if (moveMatch[3]) {
      result.promotion = moveMatch[3].toLowerCase() as PieceSymbol;
    }
    return result;
  }

  return null;
}
