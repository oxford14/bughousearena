"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chess, type Square } from "chess.js";
import { Mic, MicOff, Flag } from "lucide-react";
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
import {
  canDropPiece,
  getSeatColor,
  type BoardSeatId,
  type PieceSymbol,
} from "@/lib/game/bughouse-engine";
import { validateDrop, validateMove } from "@/lib/game/move-validator";
import { submitMove, resignMatch } from "@/lib/game/matchmaking";
import { formatClock } from "@/lib/game/clock-manager";
import { VoiceChatManager } from "@/lib/voice/webrtc";
import { useAuth } from "@/providers/auth-provider";
import { useSound } from "@/providers/sound-provider";
import { useBotController } from "@/hooks/use-bot-controller";
import { useMatchClocks } from "@/hooks/use-match-clocks";
import { ArenaBoardPanel } from "@/components/game/arena-board-panel";
import { MatchTeamChat } from "@/components/game/match-team-chat";

interface BughouseArenaProps {
  match: MatchDocument;
  boards: BoardDocument[];
}

function inferPromotion(
  fen: string,
  sourceSquare: string,
  targetSquare: string,
  seatColor: "w" | "b"
): PieceSymbol | undefined {
  const board = new Chess(fen);
  const piece = board.get(sourceSquare as Square);
  if (!piece || piece.type !== "p") return undefined;
  const rank = targetSquare[1];
  if (seatColor === "w" && rank === "8") return "q";
  if (seatColor === "b" && rank === "1") return "q";
  return undefined;
}

export function BughouseArena({ match, boards }: BughouseArenaProps) {
  const { user, profile } = useAuth();
  const { play } = useSound();
  const [muted, setMuted] = useState(false);
  const [resignOpen, setResignOpen] = useState(false);
  const [resigning, setResigning] = useState(false);
  const [voiceManager, setVoiceManager] = useState<VoiceChatManager | null>(null);
  const [selectedPiece, setSelectedPiece] = useState<PieceSymbol | null>(null);
  const prevFensRef = useRef<Map<string, string>>(new Map());
  const boardsInitializedRef = useRef(false);
  const localMoveBoardRef = useRef<string | null>(null);

  const myBoard = boards.find((b) => b.playerUid === user?.uid);
  const partnerBoard = boards.find((b) => b.id === myBoard?.partnerBoardId);
  const myTeam = myBoard?.team ?? match.players.find((p) => p.uid === user?.uid)?.team;

  const visibleBoards = useMemo(() => {
    if (myBoard && partnerBoard) return [myBoard, partnerBoard];
    if (myBoard) return [myBoard];
    return boards.slice(0, 2);
  }, [boards, myBoard, partnerBoard]);

  const opponentPlayers = useMemo(() => {
    if (!myBoard) return [];
    return match.players.filter((p) => p.team !== myBoard.team);
  }, [match.players, myBoard]);

  useBotController({ match, boards, humanUid: user?.uid });
  const { physicalClocks, getBoardClocks, getPhysicalBoardLabel, getSeatLabel } =
    useMatchClocks(match, boards);

  useEffect(() => {
    if (!user || !match.id) return;
    const manager = new VoiceChatManager(match.id, user.uid);
    void manager.start().catch(() => {});
    setVoiceManager(manager);
    return () => {
      void manager.stop();
    };
  }, [match.id, user]);

  useEffect(() => {
    if (boards.length === 0) return;

    if (!boardsInitializedRef.current) {
      for (const board of boards) {
        prevFensRef.current.set(board.id, board.fen);
      }
      boardsInitializedRef.current = true;
      return;
    }

    for (const board of boards) {
      const prev = prevFensRef.current.get(board.id);
      if (prev && prev !== board.fen) {
        if (localMoveBoardRef.current === board.id) {
          localMoveBoardRef.current = null;
        } else {
          play("gameMove");
        }
        prevFensRef.current.set(board.id, board.fen);
      }
    }
  }, [boards, play]);

  const handleMoveSync = useCallback(
    (boardId: string, sourceSquare: string, targetSquare: string): boolean => {
      if (!user) return false;
      const board = boards.find((b) => b.id === boardId);
      if (!board || board.playerUid !== user.uid) return false;
      if (board.boardStatus && board.boardStatus !== "active") return false;

      const seatColor = getSeatColor(boardId as BoardSeatId);
      const uci = `${sourceSquare}${targetSquare}`;
      const promotion = inferPromotion(board.fen, sourceSquare, targetSquare, seatColor);
      const validation = validateMove(board.fen, uci, seatColor, promotion);
      if (!validation.valid) return false;

      localMoveBoardRef.current = boardId;
      play(validation.capturedPiece ? "gameCapture" : "gameMove");

      void submitMove(match.id, boardId, user.uid, uci, undefined, undefined, promotion).catch(
        () => {}
      );

      return true;
    },
    [boards, match.id, play, user]
  );

  const handleDrop = useCallback(
    async (boardId: string, square: Square) => {
      if (!user || !selectedPiece) return;
      const board = boards.find((b) => b.id === boardId);
      if (!board || board.playerUid !== user.uid) return;
      if (board.boardStatus && board.boardStatus !== "active") return;

      const reserve = board.captured as PieceSymbol[];
      if (!canDropPiece(reserve, selectedPiece)) return;

      const seatColor = getSeatColor(boardId as BoardSeatId);
      const validation = validateDrop(board.fen, selectedPiece, square, seatColor, reserve);
      if (!validation.valid) return;

      localMoveBoardRef.current = boardId;
      play("gameDrop");

      await submitMove(
        match.id,
        boardId,
        user.uid,
        `drop:${selectedPiece}@${square}`
      );
      setSelectedPiece(null);
    },
    [boards, match.id, play, selectedPiece, user]
  );

  const handleResign = useCallback(async () => {
    if (!user) return;
    setResigning(true);
    try {
      play("uiError");
      await resignMatch(match.id, user.uid);
      setResignOpen(false);
    } catch {
      toast.error("Could not resign. Try again.");
    } finally {
      setResigning(false);
    }
  }, [match.id, play, user]);

  const boardGrid = visibleBoards.map((board) => {
    const isMine = board.playerUid === user?.uid;
    const isPartner = board.id === myBoard?.partnerBoardId;
    const player = match.players.find((p) => p.uid === board.playerUid);
    const boardLabel = isMine ? "Your board" : isPartner ? "Partner board" : "Board";
    const frozen = board.boardStatus === "stalemate";
    const clocks = getBoardClocks(board.id);

    return (
      <ArenaBoardPanel
        key={board.id}
        board={board}
        player={player}
        isMine={isMine && !frozen}
        isPartner={isPartner}
        boardLabel={frozen ? `${boardLabel} (frozen)` : boardLabel}
        myClock={clocks.mine}
        opponentClock={clocks.opponent}
        myClockRunning={clocks.mineRunning}
        opponentClockRunning={clocks.opponentRunning}
        selectedPiece={selectedPiece}
        onSelectPiece={setSelectedPiece}
        onPlaySelect={() => play("gameSelect")}
        onMove={(sourceSquare, targetSquare) =>
          handleMoveSync(board.id, sourceSquare, targetSquare)
        }
        onDrop={(square) => {
          void handleDrop(board.id, square);
        }}
      />
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4 arena-card p-4 rounded-xl border border-primary/20">
        <div className="flex gap-6 flex-wrap">
          {(["alpha", "bravo"] as const).map((physicalId) => {
            const clocks = physicalClocks[physicalId];
            return (
              <div key={physicalId}>
                <p className="text-xs text-muted-foreground mb-1">
                  {getPhysicalBoardLabel(physicalId)}
                </p>
                <div className="flex gap-3 text-sm">
                  <p
                    className={`font-heading text-lg tabular-nums ${
                      clocks.whiteRunning ? "text-primary neon-glow" : ""
                    }`}
                  >
                    {getSeatLabel("w", physicalId)}{" "}
                    {formatClock(clocks.white)}
                  </p>
                  <p
                    className={`font-heading text-lg tabular-nums ${
                      clocks.blackRunning ? "text-primary neon-glow" : ""
                    }`}
                  >
                    {getSeatLabel("b", physicalId)}{" "}
                    {formatClock(clocks.black)}
                  </p>
                </div>
              </div>
            );
          })}
          {opponentPlayers.length > 0 && (
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Opponents</p>
              <p className="text-sm font-medium truncate max-w-[240px]">
                {opponentPlayers.map((p) => p.displayName).join(" · ")}
              </p>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Badge>{match.mode}</Badge>
          <Button
            variant="outline"
            size="sm"
            className="cursor-pointer"
            onClick={() => {
              setMuted(!muted);
              voiceManager?.toggleMute(!muted);
            }}
          >
            {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            className="cursor-pointer"
            onClick={() => setResignOpen(true)}
          >
            <Flag className="h-4 w-4 mr-1" /> Resign
          </Button>
        </div>
      </div>

      <Dialog open={resignOpen} onOpenChange={setResignOpen}>
        <DialogContent showCloseButton={!resigning} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Resign match?</DialogTitle>
            <DialogDescription>
              Resigning forfeits the match for your entire team. Your opponents will win
              immediately.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-end gap-2">
            <Button
              variant="outline"
              className="cursor-pointer"
              disabled={resigning}
              onClick={() => setResignOpen(false)}
            >
              Keep playing
            </Button>
            <Button
              variant="destructive"
              className="cursor-pointer"
              disabled={resigning}
              onClick={() => void handleResign()}
            >
              {resigning ? "Resigning…" : "Resign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_minmax(240px,280px)] gap-4 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {boardGrid}
        </div>

        {user && myTeam && profile && match.playerUids?.includes(user.uid) ? (
          <MatchTeamChat
            matchId={match.id}
            team={myTeam}
            myUid={user.uid}
            myDisplayName={profile.displayName}
            disabled={match.status !== "active"}
          />
        ) : null}
      </div>
    </div>
  );
}
