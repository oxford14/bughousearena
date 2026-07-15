"use client";

import { memo, useCallback } from "react";
import type { Square } from "chess.js";
import type { BoardDocument, MatchDocument } from "@/types/firestore";
import type { MatchPlayer } from "@/types/firestore";
import type { PieceSymbol } from "@/lib/game/bughouse-engine";
import { ArenaBoardPanel } from "@/components/game/arena-board-panel";

export interface MatchBoardSlotProps {
  board: BoardDocument;
  match: MatchDocument;
  displayBoards: BoardDocument[];
  player: MatchPlayer | undefined;
  opponentPlayer: MatchPlayer | undefined;
  opponentCaptured: string[];
  isMine: boolean;
  isPartner: boolean;
  boardLabel: string;
  selectedPiece: PieceSymbol | null;
  onSelectPiece: (piece: PieceSymbol | null) => void;
  onPlaySelect: () => void;
  onMoveSync: (boardId: string, sourceSquare: string, targetSquare: string) => boolean;
  onDropSync: (boardId: string, square: Square, piece?: PieceSymbol) => boolean;
}

export const MatchBoardSlot = memo(function MatchBoardSlot({
  board,
  match,
  displayBoards,
  player,
  opponentPlayer,
  opponentCaptured,
  isMine,
  isPartner,
  boardLabel,
  selectedPiece,
  onSelectPiece,
  onPlaySelect,
  onMoveSync,
  onDropSync,
}: MatchBoardSlotProps) {
  const onMove = useCallback(
    (sourceSquare: string, targetSquare: string) =>
      onMoveSync(board.id, sourceSquare, targetSquare),
    [board.id, onMoveSync]
  );

  const onDropPiece = useCallback(
    (square: Square, piece?: PieceSymbol) => onDropSync(board.id, square, piece),
    [board.id, onDropSync]
  );

  return (
    <ArenaBoardPanel
      board={board}
      match={match}
      displayBoards={displayBoards}
      player={player}
      opponentPlayer={opponentPlayer}
      opponentCaptured={opponentCaptured}
      isMine={isMine}
      isPartner={isPartner}
      boardLabel={boardLabel}
      selectedPiece={selectedPiece}
      onSelectPiece={onSelectPiece}
      onPlaySelect={onPlaySelect}
      onMove={onMove}
      onDropPiece={onDropPiece}
    />
  );
});
