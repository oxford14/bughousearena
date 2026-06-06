"use client";

import { useMemo, useState } from "react";
import { Chessboard } from "react-chessboard";
import type { Square } from "chess.js";
import { motion } from "framer-motion";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import type { BoardDocument } from "@/types/firestore";
import type { MatchPlayer } from "@/types/firestore";
import { getValidDropSquares } from "@/lib/game/move-validator";
import { getArenaChessboardOptions } from "@/lib/game/arena-board-theme";
import { getSeatColor, type BoardSeatId, type PieceSymbol } from "@/lib/game/bughouse-engine";
import { getRankAssetPath, getRankTier } from "@/lib/game/elo";
import { isBotUid } from "@/lib/game/bots";
import { formatClock } from "@/lib/game/clock-manager";
import { PieceReserve } from "@/components/game/piece-reserve";

interface ArenaBoardPanelProps {
  board: BoardDocument;
  player: MatchPlayer | undefined;
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
  onDrop: (square: Square) => void;
  onPlaySelect: () => void;
}

export function ArenaBoardPanel({
  board,
  player,
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
  onDrop,
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
        validDropSquares,
        hoverSquare,
        onPieceDrop: ({ sourceSquare, targetSquare }) => {
          if (!targetSquare) return false;
          return onMove(sourceSquare, targetSquare);
        },
        onSquareClick: ({ square }) => {
          if (isMine && selectedPiece) {
            onDrop(square as Square);
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
      onDrop,
      onMove,
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
      <div className="flex items-center justify-between mb-2 px-1 gap-2">
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-[10px] uppercase tracking-wider text-secondary font-semibold">
            {boardLabel}
          </span>
          <div className="flex items-center gap-1.5 min-w-0">
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
              {player?.displayName ?? board.id}
              {player && isBotUid(player.uid) ? (
                <span className="text-muted-foreground font-normal"> · Bot</span>
              ) : null}
            </span>
          </div>
        </div>
        <Badge variant={board.team === 1 ? "default" : "secondary"}>Team {board.team}</Badge>
      </div>

      {(myClock != null || opponentClock != null) && (
        <div className="flex justify-between px-1 mb-2 text-xs tabular-nums">
          <span
            className={
              opponentClockRunning
                ? "text-primary font-semibold"
                : "text-muted-foreground"
            }
          >
            Opp {formatClock(opponentClock ?? 0)}
          </span>
          <span
            className={
              myClockRunning ? "text-primary font-semibold neon-glow" : "text-muted-foreground"
            }
          >
            You {formatClock(myClock ?? 0)}
          </span>
        </div>
      )}

      <div className="relative aspect-square w-full max-w-[min(100%,420px)] mx-auto rounded-lg p-1 bg-[#0a0618]/60">
        <Chessboard options={chessboardOptions} />
      </div>

      {(isMine || isPartner) && (
        <PieceReserve
          captured={board.captured}
          playerColor={seatColor}
          selectedPiece={isMine ? selectedPiece : null}
          interactive={isMine}
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
    </motion.div>
  );
}
