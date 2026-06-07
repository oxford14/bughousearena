"use client";

import { useMemo } from "react";
import { Chessboard } from "react-chessboard";
import { getChessboardOptions } from "@/lib/game/arena-board-theme";
import { useBoardTheme } from "@/providers/board-theme-provider";

/** Bd2 blocks Qc3 — legal drop while in check. */
export const LEGAL_BLOCK_DROP_FEN = "7k/8/8/8/8/2q5/8/4K3 w - - 0 1";

/** White Ke1 in check from Qc3; Bh5 does not help — illegal. */
export const ILLEGAL_SELF_CHECK_FEN = LEGAL_BLOCK_DROP_FEN;

export function RulesLegalBlockDropBoard() {
  const { themeId } = useBoardTheme();
  const options = useMemo(
    () =>
      getChessboardOptions(themeId, {
        position: LEGAL_BLOCK_DROP_FEN,
        allowDragging: false,
        showAnimations: false,
        squareStyles: {
          e1: { background: "rgba(244, 63, 94, 0.25)", boxShadow: "inset 0 0 0 1px #f43f5e" },
          c3: { background: "rgba(244, 63, 94, 0.15)" },
          d2: {
            background: "rgba(74, 222, 128, 0.45)",
            boxShadow: "inset 0 0 0 2px #4ade80",
          },
        },
      }),
    [themeId]
  );

  return (
    <div className="mx-auto max-w-[280px] aspect-square w-full">
      <Chessboard options={options} />
    </div>
  );
}

export function RulesInvalidSelfCheckBoard() {
  const { themeId } = useBoardTheme();
  const options = useMemo(
    () =>
      getChessboardOptions(themeId, {
        position: ILLEGAL_SELF_CHECK_FEN,
        allowDragging: false,
        showAnimations: false,
        squareStyles: {
          e1: { background: "rgba(244, 63, 94, 0.35)", boxShadow: "inset 0 0 0 2px #f43f5e" },
          c3: { background: "rgba(244, 63, 94, 0.2)" },
          h5: { background: "rgba(244, 63, 94, 0.45)", boxShadow: "inset 0 0 0 2px #f43f5e" },
        },
      }),
    [themeId]
  );

  return (
    <div className="mx-auto max-w-[280px] aspect-square w-full">
      <Chessboard options={options} />
    </div>
  );
}

/** Pawn drop on f8 is illegal for White. */
export const ILLEGAL_PAWN_RANK_FEN = "3k4/8/8/8/8/8/8/4K3 w - - 0 1";

export function RulesInvalidPawnRankBoard() {
  const { themeId } = useBoardTheme();
  const options = useMemo(
    () =>
      getChessboardOptions(themeId, {
        position: ILLEGAL_PAWN_RANK_FEN,
        allowDragging: false,
        showAnimations: false,
        squareStyles: {
          f8: { background: "rgba(244, 63, 94, 0.45)", boxShadow: "inset 0 0 0 2px #f43f5e" },
        },
      }),
    [themeId]
  );

  return (
    <div className="mx-auto max-w-[280px] aspect-square w-full">
      <Chessboard options={options} />
    </div>
  );
}

/** Promoted queen on e8 — if captured, partner receives a pawn. */
export const PROMOTED_CAPTURE_FEN = "4k2q/8/8/8/8/8/8/4K2R w - - 0 1";

export function RulesPromotedCaptureBoard() {
  const { themeId } = useBoardTheme();
  const options = useMemo(
    () =>
      getChessboardOptions(themeId, {
        position: PROMOTED_CAPTURE_FEN,
        allowDragging: false,
        showAnimations: false,
        squareStyles: {
          e8: {
            background: "rgba(167, 139, 250, 0.35)",
            boxShadow: "inset 0 0 0 2px rgba(167, 139, 250, 0.9)",
          },
        },
      }),
    [themeId]
  );

  return (
    <div className="mx-auto max-w-[280px] aspect-square w-full">
      <Chessboard options={options} />
    </div>
  );
}
