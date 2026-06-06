import { defaultPieces } from "react-chessboard";

const WHITE_FILL = "#F1F5F9";
const BLACK_FILL = "#1E1B4B";

function tintPiece(key: keyof typeof defaultPieces, fill: string) {
  const base = defaultPieces[key];
  return (props?: { fill?: string; square?: string; svgStyle?: React.CSSProperties }) =>
    base({
      ...props,
      fill: props?.fill ?? fill,
      svgStyle: {
        filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.35))",
        ...props?.svgStyle,
      },
    });
}

export const arenaPieces = {
  wP: tintPiece("wP", WHITE_FILL),
  wR: tintPiece("wR", WHITE_FILL),
  wN: tintPiece("wN", WHITE_FILL),
  wB: tintPiece("wB", WHITE_FILL),
  wQ: tintPiece("wQ", WHITE_FILL),
  wK: tintPiece("wK", WHITE_FILL),
  bP: tintPiece("bP", BLACK_FILL),
  bR: tintPiece("bR", BLACK_FILL),
  bN: tintPiece("bN", BLACK_FILL),
  bB: tintPiece("bB", BLACK_FILL),
  bQ: tintPiece("bQ", BLACK_FILL),
  bK: tintPiece("bK", BLACK_FILL),
};

export function reservePieceKeyFromColor(
  color: "w" | "b",
  piece: string
): keyof typeof arenaPieces {
  const map: Record<string, keyof typeof arenaPieces> = {
    p: `${color}P` as keyof typeof arenaPieces,
    r: `${color}R` as keyof typeof arenaPieces,
    n: `${color}N` as keyof typeof arenaPieces,
    b: `${color}B` as keyof typeof arenaPieces,
    q: `${color}Q` as keyof typeof arenaPieces,
  };
  return map[piece] ?? (`${color}P` as keyof typeof arenaPieces);
}

export function reservePieceKey(
  team: 1 | 2,
  piece: string
): keyof typeof arenaPieces {
  return reservePieceKeyFromColor(team === 1 ? "w" : "b", piece);
}
