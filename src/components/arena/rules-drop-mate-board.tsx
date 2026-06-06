"use client";

import { useMemo } from "react";
import { Chessboard } from "react-chessboard";
import { getArenaChessboardOptions } from "@/lib/game/arena-board-theme";

/** Qh6# — queen drop; Black Kh8; Rg8 blocks g8; h7/g7 open for the check along the h-file. */
const DROP_MATE_FEN = "6rk/5p2/7Q/8/8/8/8/4K3 b - - 0 1";

export function RulesDropMateBoard() {
  const options = useMemo(
    () =>
      getArenaChessboardOptions({
        position: DROP_MATE_FEN,
        allowDragging: false,
        showAnimations: false,
        squareStyles: {
          h6: {
            background: "rgba(74, 222, 128, 0.45)",
            boxShadow: "inset 0 0 0 2px #4ade80",
          },
        },
      }),
    []
  );

  return (
    <div className="mx-auto max-w-[320px] aspect-square w-full">
      <Chessboard options={options} />
    </div>
  );
}
