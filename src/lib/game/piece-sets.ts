export type PieceSetId = "arena" | "glass" | "pixel";

export const FREE_PIECE_SET_ID: PieceSetId = "arena";

export interface PieceSetDefinition {
  id: PieceSetId;
  label: string;
  premium?: boolean;
  whiteFill: string;
  blackFill: string;
  whiteFilter?: string;
  blackFilter?: string;
}

export const PIECE_SETS: Record<PieceSetId, PieceSetDefinition> = {
  arena: {
    id: "arena",
    label: "Arena Default",
    whiteFill: "#F1F5F9",
    blackFill: "#1E1B4B",
  },
  glass: {
    id: "glass",
    label: "Glass",
    premium: true,
    whiteFill: "#E0F2FE",
    blackFill: "#7C3AED",
    whiteFilter: "drop-shadow(0 0 6px rgba(56, 189, 248, 0.85))",
    blackFilter: "drop-shadow(0 0 6px rgba(124, 58, 237, 0.85))",
  },
  pixel: {
    id: "pixel",
    label: "Pixel",
    premium: true,
    whiteFill: "#FEF08A",
    blackFill: "#166534",
    whiteFilter: "drop-shadow(1px 1px 0 #854d0e)",
    blackFilter: "drop-shadow(1px 1px 0 #052e16)",
  },
};

export const PIECE_SET_LIST = Object.values(PIECE_SETS);

export const DEFAULT_PIECE_SET_ID: PieceSetId = "arena";

export function isPieceSetId(value: string): value is PieceSetId {
  return value in PIECE_SETS;
}
