import { defaultPieces } from "react-chessboard";
import type { PieceSetDefinition, PieceSetId } from "@/lib/game/piece-sets";
import { PIECE_SETS } from "@/lib/game/piece-sets";

function tintPiece(
  key: keyof typeof defaultPieces,
  fill: string,
  filter?: string
) {
  const base = defaultPieces[key];
  return (props?: { fill?: string; square?: string; svgStyle?: React.CSSProperties }) =>
    base({
      ...props,
      fill: props?.fill ?? fill,
      svgStyle: {
        filter: filter ?? "drop-shadow(0 1px 2px rgba(0,0,0,0.35))",
        ...props?.svgStyle,
      },
    });
}

export function buildPieceSet(definition: PieceSetDefinition) {
  const { whiteFill, blackFill, whiteFilter, blackFilter } = definition;
  return {
    wP: tintPiece("wP", whiteFill, whiteFilter),
    wR: tintPiece("wR", whiteFill, whiteFilter),
    wN: tintPiece("wN", whiteFill, whiteFilter),
    wB: tintPiece("wB", whiteFill, whiteFilter),
    wQ: tintPiece("wQ", whiteFill, whiteFilter),
    wK: tintPiece("wK", whiteFill, whiteFilter),
    bP: tintPiece("bP", blackFill, blackFilter),
    bR: tintPiece("bR", blackFill, blackFilter),
    bN: tintPiece("bN", blackFill, blackFilter),
    bB: tintPiece("bB", blackFill, blackFilter),
    bQ: tintPiece("bQ", blackFill, blackFilter),
    bK: tintPiece("bK", blackFill, blackFilter),
  };
}

export type ArenaPieces = ReturnType<typeof buildPieceSet>;

export function getPiecesForSet(pieceSetId: PieceSetId): ArenaPieces {
  const definition = PIECE_SETS[pieceSetId] ?? PIECE_SETS.arena;
  return buildPieceSet(definition);
}

export const arenaPieces = getPiecesForSet("arena");

export function reservePieceKeyFromColor(
  color: "w" | "b",
  piece: string
): keyof ArenaPieces {
  const map: Record<string, keyof ArenaPieces> = {
    p: `${color}P` as keyof ArenaPieces,
    r: `${color}R` as keyof ArenaPieces,
    n: `${color}N` as keyof ArenaPieces,
    b: `${color}B` as keyof ArenaPieces,
    q: `${color}Q` as keyof ArenaPieces,
  };
  return map[piece] ?? (`${color}P` as keyof ArenaPieces);
}

const PIECE_TYPE_TO_SYMBOL: Record<string, import("@/lib/game/bughouse-engine").PieceSymbol> = {
  wP: "p",
  wR: "r",
  wN: "n",
  wB: "b",
  wQ: "q",
  bP: "p",
  bR: "r",
  bN: "n",
  bB: "b",
  bQ: "q",
};

export function pieceTypeToSymbol(
  pieceType: string
): import("@/lib/game/bughouse-engine").PieceSymbol | null {
  return PIECE_TYPE_TO_SYMBOL[pieceType] ?? null;
}

export function reservePieceKey(
  team: 1 | 2,
  piece: string
): keyof ArenaPieces {
  return reservePieceKeyFromColor(team === 1 ? "w" : "b", piece);
}
