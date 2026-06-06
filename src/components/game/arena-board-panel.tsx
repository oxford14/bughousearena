"use client";

import { useMemo, useState } from "react";
import { Chessboard, ChessboardProvider } from "react-chessboard";
import { Chess, type Square } from "chess.js";
import { motion } from "framer-motion";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import type { BoardDocument } from "@/types/firestore";
import type { MatchPlayer } from "@/types/firestore";
import { getValidDropSquares } from "@/lib/game/move-validator";
import { getArenaChessboardOptions } from "@/lib/game/arena-board-theme";
import { canDropPiece, getSeatColor, type BoardSeatId, type PieceSymbol } from "@/lib/game/bughouse-engine";
import { pieceTypeToSymbol } from "@/components/game/arena-pieces";
import { getRankAssetPath, getRankTier } from "@/lib/game/elo";
import { isBotUid } from "@/lib/game/bots";
import { formatClock } from "@/lib/game/clock-manager";
import { PieceReserve } from "@/components/game/piece-reserve";
import { cn } from "@/lib/utils";

interface ArenaBoardPanelProps {
  board: BoardDocument;
  player: MatchPlayer | undefined;
  opponentPlayer?: MatchPlayer | undefined;
  isMine: boolean;
  isPartner: boolean;
  boardLabel: string;
  myClock?: number;
  opponentClock?: number;
  myClockRunning?: boolean;
  opponentClockRunning?: boolean;
  selectedPiece: PieceSymbol | null;
  onSelectPiece: (piece: PieceSymbol | null) => void;
  onMove: (sourceSquare: string, targetSquare: string) => boolean;
  onDropPiece: (square: Square, piece?: PieceSymbol) => boolean;
  onPlaySelect: () => void;
}

function PlayerLine({
  player,
  fallback,
  clock,
  clockRunning,
  isSelf,
}: {
  player: MatchPlayer | undefined;
  fallback: string;
  clock?: number;
  clockRunning?: boolean;
  isSelf?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5 px-1 min-w-0">
      {player ? (
        <Image
          src={getRankAssetPath(player.rankTier ?? getRankTier(player.rating))}
          alt=""
          width={18}
          height={18}
          className="shrink-0"
        />
      ) : null}
      <span className="text-sm font-medium truncate">
        {isSelf ? "You" : player?.displayName ?? fallback}
        {player && isBotUid(player.uid) ? (
          <span className="text-muted-foreground font-normal"> · Bot</span>
        ) : null}
      </span>
      {clock != null ? (
        <span
          className={cn(
            "ml-auto text-xs tabular-nums shrink-0",
            clockRunning ? "text-primary font-semibold neon-glow" : "text-muted-foreground"
          )}
        >
          {formatClock(clock)}
        </span>
      ) : null}
    </div>
  );
}

export function ArenaBoardPanel({
  board,
  player,
  opponentPlayer,
  isMine,
  isPartner,
  boardLabel,
  myClock,
  opponentClock,
  myClockRunning,
  opponentClockRunning,
  selectedPiece,
  onSelectPiece,
  onMove,
  onDropPiece,
  onPlaySelect,
}: ArenaBoardPanelProps) {
  const [hoverSquare, setHoverSquare] = useState<string | null>(null);

  const seatColor = getSeatColor(board.id as BoardSeatId);
  const reserve = board.captured as PieceSymbol[];

  const validDropSquares = useMemo(() => {
    if (!isMine || !selectedPiece) return [];
    return getValidDropSquares(board.fen, selectedPiece, seatColor, reserve);
  }, [board.fen, isMine, reserve, seatColor, selectedPiece]);

  const boardOrientation = seatColor === "b" ? "black" : "white";

  const chessboardOptions = useMemo(
    () =>
      getArenaChessboardOptions({
        position: board.fen,
        boardOrientation,
        allowDragging: isMine,
        allowDragOffBoard: false,
        validDropSquares,
        hoverSquare,
        canDragPiece: ({ isSparePiece, piece }) => {
          if (!isMine) return false;
          const chess = new Chess(board.fen);
          if (chess.turn() !== seatColor) return false;
          if (isSparePiece) {
            const symbol = pieceTypeToSymbol(piece.pieceType);
            return symbol ? canDropPiece(reserve, symbol) : false;
          }
          return true;
        },
        onPieceDrag: ({ isSparePiece, piece }) => {
          if (!isMine || !isSparePiece) return;
          const symbol = pieceTypeToSymbol(piece.pieceType);
          if (symbol) onSelectPiece(symbol);
        },
        onPieceClick: ({ isSparePiece, piece }) => {
          if (!isMine || !isSparePiece) return;
          const symbol = pieceTypeToSymbol(piece.pieceType);
          if (!symbol) return;
          if (selectedPiece === symbol) {
            onSelectPiece(null);
          } else {
            onSelectPiece(symbol);
            onPlaySelect();
          }
        },
        onPieceDrop: ({ piece, sourceSquare, targetSquare }) => {
          if (!targetSquare) return false;
          if (piece.isSparePiece) {
            const symbol = pieceTypeToSymbol(piece.pieceType);
            if (!symbol) return false;
            const ok = onDropPiece(targetSquare as Square, symbol);
            if (ok) onSelectPiece(null);
            return ok;
          }
          return onMove(sourceSquare, targetSquare);
        },
        onSquareClick: ({ square }) => {
          if (isMine && selectedPiece) {
            const ok = onDropPiece(square as Square);
            if (ok) onSelectPiece(null);
          }
        },
        onMouseOverSquare: ({ square }) => {
          if (isMine && selectedPiece) {
            setHoverSquare(square);
          }
        },
        onMouseOutSquare: () => setHoverSquare(null),
      }),
    [
      board.fen,
      boardOrientation,
      hoverSquare,
      isMine,
      onDropPiece,
      onMove,
      onPlaySelect,
      onSelectPiece,
      reserve,
      selectedPiece,
      validDropSquares,
    ]
  );

  return (
    <motion.div
      className={`relative rounded-2xl p-2 md:p-3 arena-card border ${
        isMine
          ? "border-primary/50 shadow-[0_0_32px_rgba(124,58,237,0.2)]"
          : isPartner
            ? "border-secondary/40"
            : "border-primary/20"
      }`}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
    >
      <div className="flex items-center justify-between mb-1.5 px-1 gap-2">
        <span className="text-[10px] uppercase tracking-wider text-secondary font-semibold">
          {boardLabel}
        </span>
        <Badge variant={board.team === 1 ? "default" : "secondary"}>Team {board.team}</Badge>
      </div>

      {/* Opponent sits across the board (top of POV). */}
      <PlayerLine
        player={opponentPlayer}
        fallback="Opponent"
        clock={opponentClock}
        clockRunning={opponentClockRunning}
      />

      <ChessboardProvider options={chessboardOptions}>
        <div className="relative aspect-square w-full max-w-[min(100%,420px)] mx-auto rounded-lg p-1 my-1.5 bg-[#0a0618]/60">
          <Chessboard options={chessboardOptions} />
        </div>

        {/* This board's player sits at the bottom (your POV). */}
        <PlayerLine
          player={player}
          fallback={board.id}
          clock={myClock}
          clockRunning={myClockRunning}
          isSelf={isMine}
        />

        {(isMine || isPartner) && (
          <PieceReserve
            captured={board.captured}
            playerColor={seatColor}
            selectedPiece={isMine ? selectedPiece : null}
            interactive={isMine}
            draggable={isMine}
            label={
              isMine ? "Your reserve (captured pieces)" : "Partner reserve"
            }
            onSelect={(piece) => {
              if (selectedPiece === piece) {
                onSelectPiece(null);
              } else {
                onSelectPiece(piece);
                onPlaySelect();
              }
            }}
          />
        )}
      </ChessboardProvider>
    </motion.div>
  );
}
