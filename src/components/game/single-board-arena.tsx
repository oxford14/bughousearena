"use client";

import { useCallback, useEffect, useState } from "react";
import { Chess, type Square } from "chess.js";
import { Flag } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { BoardDocument, MatchDocument } from "@/types/firestore";
import type { PieceSymbol } from "@/lib/game/single-board-engine";
import {
  SINGLE_BOARD_ID,
  listAtomicLegalUciMoves,
  validateAtomicMove,
  validateCrazyhouseDrop,
  validateStandardMove,
} from "@/lib/game/single-board-engine";
import { submitMove, resignMatch } from "@/lib/game/matchmaking";
import { formatTimeControl, matchTimeControlSeconds } from "@/lib/game/time-control";
import { getGameTypeMeta, normalizeGameType } from "@/lib/game/game-types";
import {
  needsPawnPromotion,
  type PendingPromotion,
} from "@/lib/game/promotion";
import { useAuth } from "@/providers/auth-provider";
import { useSound } from "@/providers/sound-provider";
import { MatchBoardSlot } from "@/components/game/match-board-slot";
import { BoardThemeSelector } from "@/components/arena/board-theme-selector";
import { PieceSetSelector } from "@/components/arena/piece-set-selector";
import { MatchNowProvider } from "@/components/game/match-now-context";
import { PromotionPickerDialog } from "@/components/game/promotion-picker-dialog";
import { submitTimeForfeit } from "@/lib/game/match-actions";
import { isBotUid } from "@/lib/game/bots";

interface SingleBoardArenaProps {
  match: MatchDocument;
  boards: BoardDocument[];
}

function formatClock(sec: number | undefined): string {
  const s = Math.max(0, Math.floor(sec ?? 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export function SingleBoardArena({ match, boards }: SingleBoardArenaProps) {
  const { user } = useAuth();
  const { play } = useSound();
  const [resignOpen, setResignOpen] = useState(false);
  const [resigning, setResigning] = useState(false);
  const [selectedPiece, setSelectedPiece] = useState<PieceSymbol | null>(null);
  const [pendingPromotion, setPendingPromotion] =
    useState<PendingPromotion | null>(null);

  const gameType = normalizeGameType(match.gameType);
  const myPlayer = match.players.find((p) => p.uid === user?.uid);
  const opponent = match.players.find((p) => p.uid !== user?.uid);
  const myColor = myPlayer?.playerColor ?? (myPlayer?.team === 1 ? "w" : "b");

  const board =
    boards.find((b) => b.id === SINGLE_BOARD_ID) ?? boards[0];

  // Simple 1v1 bot: play a random legal move when it is the bot's turn.
  useEffect(() => {
    if (match.status !== "active" || !board) return;
    const bot = match.players.find((p) => p.isBot || isBotUid(p.uid));
    if (!bot) return;
    const botColor = bot.playerColor ?? (bot.team === 1 ? "w" : "b");
    if (board.turn !== botColor) return;

    const timer = window.setTimeout(() => {
      try {
        let uci: string | null = null;
        let promo: PieceSymbol | undefined;
        if (gameType === "atomic") {
          const legal = listAtomicLegalUciMoves(board.fen, botColor);
          if (legal.length === 0) return;
          uci = legal[Math.floor(Math.random() * legal.length)]!;
          promo = uci.length > 4 ? (uci[4] as PieceSymbol) : undefined;
        } else {
          const chess = new Chess(board.fen);
          const moves = chess.moves({ verbose: true });
          if (moves.length === 0) return;
          const pick = moves[Math.floor(Math.random() * moves.length)]!;
          promo = pick.promotion as PieceSymbol | undefined;
          uci = `${pick.from}${pick.to}${promo ?? ""}`;
        }
        void submitMove(
          match.id,
          board.id,
          bot.uid,
          uci,
          undefined,
          undefined,
          promo
        );
      } catch {
        /* ignore */
      }
    }, 600);

    return () => window.clearTimeout(timer);
  }, [match, board, gameType]);

  // Clock forfeit poll
  useEffect(() => {
    if (match.status !== "active") return;
    const id = window.setInterval(() => {
      void submitTimeForfeit(match.id);
    }, 2000);
    return () => window.clearInterval(id);
  }, [match.id, match.status]);

  const handlePlaySelect = useCallback(() => {
    play("gameSelect");
  }, [play]);

  const commitMove = useCallback(
    (
      boardId: string,
      sourceSquare: string,
      targetSquare: string,
      promotion?: PieceSymbol
    ): boolean => {
      if (!user || !board || board.id !== boardId) return false;
      const fen = board.fen;
      const move = `${sourceSquare}${targetSquare}`;
      const validated =
        gameType === "atomic"
          ? validateAtomicMove(fen, move, myColor, promotion)
          : validateStandardMove(fen, move, myColor, promotion);
      if (!validated.valid) {
        toast.error(validated.error ?? "Illegal move");
        return false;
      }

      play(validated.capturedPiece ? "gameCapture" : "gameMove");

      void submitMove(
        match.id,
        boardId,
        user.uid,
        move,
        undefined,
        undefined,
        promotion
      ).catch((err) => {
        toast.error(err instanceof Error ? err.message : "Move failed");
      });

      setSelectedPiece(null);
      return true;
    },
    [user, board, myColor, match.id, play, gameType]
  );

  const handleMoveSync = useCallback(
    (boardId: string, sourceSquare: string, targetSquare: string): boolean => {
      if (!user || !board || board.id !== boardId) return false;
      if (board.turn !== myColor) return false;

      if (needsPawnPromotion(board.fen, sourceSquare, targetSquare, myColor)) {
        setPendingPromotion({
          boardId,
          from: sourceSquare,
          to: targetSquare,
          seatColor: myColor,
        });
        return false;
      }

      return commitMove(boardId, sourceSquare, targetSquare);
    },
    [user, board, myColor, commitMove]
  );

  const handlePromotionSelect = useCallback(
    (piece: PieceSymbol) => {
      if (!pendingPromotion) return;
      const { boardId, from, to } = pendingPromotion;
      setPendingPromotion(null);
      commitMove(boardId, from, to, piece);
    },
    [commitMove, pendingPromotion]
  );

  const handleDropSync = useCallback(
    (boardId: string, square: Square, piece?: PieceSymbol): boolean => {
      if (gameType !== "crazyhouse" || !user || !board) return false;
      if (board.turn !== myColor) return false;
      const dropPiece = piece ?? selectedPiece;
      if (!dropPiece) return false;

      const validated = validateCrazyhouseDrop(
        board.fen,
        dropPiece,
        square,
        myColor,
        board.captured ?? []
      );
      if (!validated.valid) {
        toast.error(validated.error ?? "Illegal drop");
        return false;
      }

      const move = `${dropPiece}@${square}`;
      play("gameDrop");

      void submitMove(match.id, boardId, user.uid, move).catch((err) => {
        toast.error(err instanceof Error ? err.message : "Drop failed");
      });

      setSelectedPiece(null);
      return true;
    },
    [gameType, user, board, selectedPiece, myColor, match.id, play]
  );

  const handleResign = async () => {
    if (!user) return;
    setResigning(true);
    try {
      await resignMatch(match.id, user.uid);
      setResignOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not resign");
    } finally {
      setResigning(false);
    }
  };

  const whiteClock = board?.whiteClock ?? matchTimeControlSeconds(match);
  const blackClock = board?.blackClock ?? matchTimeControlSeconds(match);

  if (!board) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-muted-foreground">
        Loading board…
      </div>
    );
  }

  return (
    <MatchNowProvider active={match.status === "active"}>
    <div className="mx-auto max-w-3xl space-y-4 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-heading text-xl capitalize">
            {getGameTypeMeta(gameType).shortLabel}
            {gameType === "standard" ? " Chess" : ""}
          </h1>
          <p className="text-xs text-muted-foreground">
            {formatTimeControl(matchTimeControlSeconds(match))} · {match.mode}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <BoardThemeSelector />
          <PieceSetSelector />
          <Button
            variant="outline"
            size="sm"
            className="cursor-pointer text-destructive"
            onClick={() => setResignOpen(true)}
          >
            <Flag className="mr-1 h-4 w-4" />
            Resign
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-card/40 px-4 py-2 text-sm">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">Black</Badge>
          <span>{opponent && myColor === "w" ? opponent.displayName : myPlayer?.displayName}</span>
          <span className="font-mono tabular-nums">{formatClock(blackClock)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono tabular-nums">{formatClock(whiteClock)}</span>
          <span>{opponent && myColor === "b" ? opponent.displayName : myPlayer?.displayName}</span>
          <Badge variant="secondary">White</Badge>
        </div>
      </div>

      <MatchBoardSlot
        board={board}
        match={match}
        displayBoards={boards}
        player={myPlayer}
        opponentPlayer={opponent}
        opponentCaptured={[]}
        isMine
        isPartner={false}
        boardLabel={getGameTypeMeta(gameType).shortLabel}
        selectedPiece={selectedPiece}
        onSelectPiece={(p) => setSelectedPiece(p)}
        onPlaySelect={handlePlaySelect}
        onMoveSync={handleMoveSync}
        onDropSync={handleDropSync}
      />

      <Dialog open={resignOpen} onOpenChange={setResignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resign?</DialogTitle>
            <DialogDescription>
              You will lose this match. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResignOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={resigning}
              onClick={() => void handleResign()}
            >
              Resign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PromotionPickerDialog
        pending={pendingPromotion}
        onSelect={(piece) => handlePromotionSelect(piece as PieceSymbol)}
        onCancel={() => setPendingPromotion(null)}
      />
    </div>
    </MatchNowProvider>
  );
}
