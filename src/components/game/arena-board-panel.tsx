"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Chessboard, ChessboardProvider } from "react-chessboard";
import { Chess, type Square } from "chess.js";
import { motion } from "framer-motion";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import type { BoardDocument } from "@/types/firestore";
import type { MatchPlayer } from "@/types/firestore";
import { getValidDropSquares, getValidMoveSquares, getCheckHighlightState } from "@/lib/game/move-validator";
import { getChessboardOptions } from "@/lib/game/arena-board-theme";
import { canDropPiece, getSeatColor, type BoardSeatId, type PieceSymbol } from "@/lib/game/bughouse-engine";
import { useBoardTheme } from "@/providers/board-theme-provider";
import { usePieceSet } from "@/providers/piece-set-provider";
import { pieceTypeToSymbol } from "@/components/game/arena-pieces";
import { getRankAssetPath, getRankTier } from "@/lib/game/elo";
import { isBotUid } from "@/lib/game/bots";
import { formatClock } from "@/lib/game/clock-manager";
import { PieceReserve, OpponentReserveStrip } from "@/components/game/piece-reserve";
import { cn } from "@/lib/utils";

interface ArenaBoardPanelProps {
  board: BoardDocument;
  player: MatchPlayer | undefined;
  opponentPlayer?: MatchPlayer | undefined;
  opponentCaptured?: string[];
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
  turnBadge,
}: {
  player: MatchPlayer | undefined;
  fallback: string;
  clock?: number;
  clockRunning?: boolean;
  isSelf?: boolean;
  turnBadge?: ReactNode;
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
      <span className="text-sm font-medium truncate min-w-0">
        {isSelf ? "You" : player?.displayName ?? fallback}
        {player && isBotUid(player.uid) ? (
          <span className="text-muted-foreground font-normal"> · Bot</span>
        ) : null}
      </span>
      {turnBadge ? <div className="shrink-0">{turnBadge}</div> : null}
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

function TurnBadge({
  label,
  variant = "yours",
}: {
  label: string;
  variant?: "yours" | "partner" | "opponent";
}) {
  const styles =
    variant === "yours"
      ? "border-[#4ade80]/50 bg-[#4ade80]/15 text-[#4ade80] animate-pulse"
      : variant === "partner"
        ? "border-secondary/50 bg-secondary/15 text-secondary"
        : "border-muted-foreground/40 bg-muted/30 text-muted-foreground";

  return (
    <Badge className={cn("text-[10px] uppercase tracking-wide border", styles)}>
      {label}
    </Badge>
  );
}

export function ArenaBoardPanel({
  board,
  player,
  opponentPlayer,
  opponentCaptured = [],
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
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const { themeId } = useBoardTheme();
  const { pieces } = usePieceSet();

  const seatColor = getSeatColor(board.id as BoardSeatId);
  const reserve = board.captured as PieceSymbol[];
  const opponentSeatColor = seatColor === "w" ? "b" : "w";
  const isMyTurn =
    isMine &&
    board.boardStatus === "active" &&
    board.turn === seatColor;
  const isPartnerTurn =
    isPartner &&
    board.boardStatus === "active" &&
    board.turn === seatColor;

  useEffect(() => {
    setSelectedSquare(null);
    setHoverSquare(null);
  }, [board.fen]);

  useEffect(() => {
    if (!isMyTurn) {
      setSelectedSquare(null);
    }
  }, [isMyTurn]);

  useEffect(() => {
    if (selectedPiece) {
      setSelectedSquare(null);
    }
  }, [selectedPiece]);

  const validDropSquares = useMemo(() => {
    if (!isMine || !selectedPiece) return [];
    return getValidDropSquares(board.fen, selectedPiece, seatColor, reserve);
  }, [board.fen, isMine, reserve, seatColor, selectedPiece]);

  const validMoveSquares = useMemo(() => {
    if (!isMine || !isMyTurn || !selectedSquare || selectedPiece) return [];
    return getValidMoveSquares(board.fen, selectedSquare, seatColor);
  }, [board.fen, isMine, isMyTurn, seatColor, selectedPiece, selectedSquare]);

  const showCheckHighlight = (isMyTurn || isPartnerTurn) && board.boardStatus === "active";
  const checkState = useMemo(() => {
    if (!showCheckHighlight) {
      return { inCheck: false, kingSquare: null, attackerSquares: [] as Square[] };
    }
    return getCheckHighlightState(board.fen, seatColor);
  }, [board.fen, seatColor, showCheckHighlight]);

  const isPlayerInCheck = isMyTurn && checkState.inCheck;
  const opponentCheckState = useMemo(() => {
    if (board.turn !== opponentSeatColor) {
      return { inCheck: false, kingSquare: null, attackerSquares: [] as Square[] };
    }
    return getCheckHighlightState(board.fen, opponentSeatColor);
  }, [board.fen, board.turn, opponentSeatColor]);
  const isOpponentInCheck = opponentCheckState.inCheck;
  const isOpponentTurn =
    board.boardStatus === "active" && board.turn === opponentSeatColor;

  const bottomTurnBadge =
    isMyTurn || isPartnerTurn || isPlayerInCheck ? (
      <div className="flex items-center gap-1.5">
        {isPlayerInCheck ? (
          <Badge className="border border-red-500/60 bg-red-500/20 text-red-400 text-[10px] uppercase tracking-wide animate-pulse">
            Check
          </Badge>
        ) : null}
        {isMyTurn ? <TurnBadge label="Your turn" variant="yours" /> : null}
        {isPartnerTurn ? <TurnBadge label="Partner's turn" variant="partner" /> : null}
      </div>
    ) : null;

  const opponentTurnBadge = isOpponentTurn ? (
    <div className="flex items-center gap-1.5">
      {isOpponentInCheck ? (
        <Badge className="border border-red-500/60 bg-red-500/20 text-red-400 text-[10px] uppercase tracking-wide animate-pulse">
          Check
        </Badge>
      ) : null}
      <TurnBadge label="Opponent's turn" variant="opponent" />
    </div>
  ) : null;

  const selectBoardSquare = (square: Square) => {
    const chess = new Chess(board.fen);
    if (chess.turn() !== seatColor) return;
    const piece = chess.get(square);
    if (!piece || piece.color !== seatColor) return;
    onSelectPiece(null);
    setSelectedSquare((prev) => (prev === square ? null : square));
    onPlaySelect();
  };

  const tryMoveFromSelection = (targetSquare: Square): boolean => {
    if (!selectedSquare) return false;
    if (!validMoveSquares.includes(targetSquare)) return false;
    const ok = onMove(selectedSquare, targetSquare);
    if (ok) {
      setSelectedSquare(null);
      setHoverSquare(null);
    }
    return ok;
  };

  const boardOrientation = seatColor === "b" ? "black" : "white";

  const chessboardOptions = useMemo(
    () =>
      getChessboardOptions(themeId, {
        pieces,
        position: board.fen,
        boardOrientation,
        allowDragging: isMine,
        allowDragOffBoard: false,
        animationDurationInMs: 0,
        validDropSquares,
        validMoveSquares,
        selectedSquare,
        hoverSquare,
        checkKingSquare: showCheckHighlight ? checkState.kingSquare : null,
        checkAttackerSquares: showCheckHighlight ? checkState.attackerSquares : [],
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
        onPieceDrag: ({ isSparePiece, piece, square }) => {
          if (!isMine) return;
          if (isSparePiece) {
            const symbol = pieceTypeToSymbol(piece.pieceType);
            if (symbol) onSelectPiece(symbol);
            return;
          }
          onSelectPiece(null);
          if (square) {
            setSelectedSquare(square as Square);
          }
        },
        onPieceClick: ({ isSparePiece, piece, square }) => {
          if (!isMine || !isMyTurn) return;
          if (isSparePiece) {
            const symbol = pieceTypeToSymbol(piece.pieceType);
            if (!symbol) return;
            setSelectedSquare(null);
            if (selectedPiece === symbol) {
              onSelectPiece(null);
            } else {
              onSelectPiece(symbol);
              onPlaySelect();
            }
            return;
          }
          if (!square) return;
          selectBoardSquare(square as Square);
        },
        onPieceDrop: ({ piece, sourceSquare, targetSquare }) => {
          if (!targetSquare) {
            setSelectedSquare(null);
            return false;
          }
          if (piece.isSparePiece) {
            const symbol = pieceTypeToSymbol(piece.pieceType);
            if (!symbol) return false;
            const ok = onDropPiece(targetSquare as Square, symbol);
            if (ok) onSelectPiece(null);
            return ok;
          }
          const ok = onMove(sourceSquare, targetSquare);
          if (ok) {
            setSelectedSquare(null);
            setHoverSquare(null);
          }
          return ok;
        },
        onSquareClick: ({ piece, square }) => {
          if (!isMine || !isMyTurn) return;
          if (selectedPiece) {
            const ok = onDropPiece(square as Square);
            if (ok) onSelectPiece(null);
            return;
          }
          if (!selectedSquare) return;
          if (tryMoveFromSelection(square as Square)) return;
          if (!piece) {
            setSelectedSquare(null);
          }
        },
        onMouseOverSquare: ({ square }) => {
          if (isMine && (selectedPiece || selectedSquare)) {
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
      isMyTurn,
      onDropPiece,
      onMove,
      onPlaySelect,
      onSelectPiece,
      reserve,
      selectedPiece,
      selectedSquare,
      seatColor,
      themeId,
      pieces,
      validDropSquares,
      validMoveSquares,
      checkState.attackerSquares,
      checkState.kingSquare,
      showCheckHighlight,
    ]
  );

  return (
    <motion.div
      className={cn(
        "relative rounded-2xl p-2 md:p-3 arena-card border transition-shadow",
        isMyTurn
          ? "border-[#4ade80]/60 shadow-[0_0_36px_rgba(74,222,128,0.28)] ring-2 ring-[#4ade80]/35"
          : isMine
            ? "border-primary/50 shadow-[0_0_32px_rgba(124,58,237,0.2)]"
            : isPartner
              ? "border-secondary/40"
              : "border-primary/20"
      )}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
    >
      <div className="flex items-center justify-between mb-1.5 px-1 gap-2">
        <span className="text-[10px] uppercase tracking-wider text-secondary font-semibold">
          {boardLabel}
        </span>
        <div className="flex items-center gap-1.5">
          <Badge variant={board.team === 1 ? "default" : "secondary"}>Team {board.team}</Badge>
        </div>
      </div>

      {/* Opponent sits across the board (top of POV). */}
      <PlayerLine
        player={opponentPlayer}
        fallback="Opponent"
        clock={opponentClock}
        clockRunning={opponentClockRunning}
        turnBadge={opponentTurnBadge}
      />
      <OpponentReserveStrip
        captured={opponentCaptured}
        playerColor={opponentSeatColor}
        opponentName={opponentPlayer?.displayName}
      />

      <ChessboardProvider options={chessboardOptions}>
        <div
          className={cn(
            "relative aspect-square w-full max-w-[min(100%,420px)] mx-auto rounded-lg p-1 my-1.5 bg-[#0a0618]/60",
            isPlayerInCheck
              ? "ring-2 ring-red-500/70 ring-offset-2 ring-offset-[#0a0618]"
              : isMyTurn && "ring-2 ring-[#4ade80]/40 ring-offset-2 ring-offset-[#0a0618]",
          )}
        >
          <Chessboard options={chessboardOptions} />
        </div>

        {/* This board's player sits at the bottom (your POV). */}
        <PlayerLine
          player={player}
          fallback={isBotUid(board.playerUid) ? "Bot" : "Player"}
          clock={myClock}
          clockRunning={myClockRunning}
          isSelf={isMine}
          turnBadge={bottomTurnBadge}
        />
        {isMyTurn ? (
          <p
            className={cn(
              "mt-1 text-center text-[10px] font-semibold uppercase tracking-[0.18em]",
              isPlayerInCheck ? "text-red-400 animate-pulse" : "text-[#4ade80]"
            )}
          >
            {isPlayerInCheck
              ? "You're in check — move your king, block, capture, or drop"
              : selectedPiece
                ? "Tap a green square to drop"
                : selectedSquare
                  ? "Tap a green square to move"
                  : "Tap or drag a piece to move"}
          </p>
        ) : isPartnerTurn && checkState.inCheck ? (
          <p className="mt-1 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-red-400/90">
            Partner is in check
          </p>
        ) : null}

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
