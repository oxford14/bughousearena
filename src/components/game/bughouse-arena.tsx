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
  getMirrorSeats,
  getSeatColor,
  type BoardSeatId,
  type PieceSymbol,
} from "@/lib/game/bughouse-engine";
import { validateDrop, validateMove } from "@/lib/game/move-validator";
import { submitMove, resignMatch } from "@/lib/game/matchmaking";
import { formatClock } from "@/lib/game/clock-manager";
import { formatTimeControl, matchTimeControlSeconds } from "@/lib/game/time-control";
import { VoiceChatManager } from "@/lib/voice/webrtc";
import { useAuth } from "@/providers/auth-provider";
import { useSound } from "@/providers/sound-provider";
import { useBotController } from "@/hooks/use-bot-controller";
import { useMatchClocks } from "@/hooks/use-match-clocks";
import { useOptimisticBoards } from "@/hooks/use-optimistic-boards";
import { ArenaBoardPanel } from "@/components/game/arena-board-panel";
import { BoardThemeSelector } from "@/components/arena/board-theme-selector";
import { PieceSetSelector } from "@/components/arena/piece-set-selector";
import { MatchTeamChatDock } from "@/components/game/match-team-chat-dock";

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
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(
    new Map()
  );
  const [selectedPiece, setSelectedPiece] = useState<PieceSymbol | null>(null);
  const prevFensRef = useRef<Map<string, string>>(new Map());
  const boardsInitializedRef = useRef(false);
  const localMoveBoardRef = useRef<string | null>(null);

  const myPlayer = match.players.find((p) => p.uid === user?.uid);
  const myBoard =
    boards.find((b) => b.id === myPlayer?.boardId) ??
    boards.find((b) => b.playerUid === user?.uid);
  const partnerBoard = boards.find((b) => b.id === myBoard?.partnerBoardId);
  const myTeam = myPlayer?.team ?? myBoard?.team;

  const { displayBoards, applyOptimistic, clearOptimistic } = useOptimisticBoards(boards);

  const visibleBoards = useMemo(() => {
    const mySeatId = myPlayer?.boardId;
    const myDisplayBoard =
      displayBoards.find((b) => b.id === mySeatId) ??
      displayBoards.find((b) => b.playerUid === user?.uid);
    const partnerDisplayBoard = displayBoards.find(
      (b) => b.id === myDisplayBoard?.partnerBoardId
    );
    if (myDisplayBoard && partnerDisplayBoard) {
      return [myDisplayBoard, partnerDisplayBoard];
    }
    if (myDisplayBoard) return [myDisplayBoard];
    return displayBoards.slice(0, 2);
  }, [displayBoards, myPlayer?.boardId, user?.uid]);

  const { physicalClocks, getBoardClocks, getPhysicalBoardLabel, getPhysicalSeatPlayer } =
    useMatchClocks(match, displayBoards);
  const voiceTeammateUids = useMemo(() => {
    if (!user || !myTeam) return [];
    const seen = new Set<string>();
    return match.players
      .filter((p) => p.team === myTeam && p.uid !== user.uid && !p.isBot)
      .map((p) => p.uid)
      .filter((uid) => (seen.has(uid) ? false : (seen.add(uid), true)));
  }, [match.players, myTeam, user]);

  useBotController({ match, boards: displayBoards, humanUid: user?.uid });

  useEffect(() => {
    if (!user || !match.id || !myTeam) return;
    // Team-scoped room: opponents use a different room and never receive our audio.
    const roomId = `${match.id}-team-${myTeam}`;
    const manager = new VoiceChatManager(roomId, user.uid);
    manager.onRemoteStream = (peerId, stream) => {
      setRemoteStreams((prev) => new Map(prev).set(peerId, stream));
    };
    manager.onPeerDisconnected = (peerId) => {
      setRemoteStreams((prev) => {
        const next = new Map(prev);
        next.delete(peerId);
        return next;
      });
    };
    void manager.start().catch(() => {});
    setVoiceManager(manager);
    return () => {
      setRemoteStreams(new Map());
      void manager.stop();
    };
  }, [match.id, user, myTeam]);

  useEffect(() => {
    if (!voiceManager || voiceTeammateUids.length === 0) return;
    void voiceManager.connectTo(voiceTeammateUids).catch(() => {});
  }, [voiceManager, voiceTeammateUids]);

  useEffect(() => {
    if (displayBoards.length === 0) return;

    if (!boardsInitializedRef.current) {
      for (const board of displayBoards) {
        prevFensRef.current.set(board.id, board.fen);
      }
      boardsInitializedRef.current = true;
      return;
    }

    for (const board of displayBoards) {
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
  }, [displayBoards, play]);

  const handleMoveSync = useCallback(
    (boardId: string, sourceSquare: string, targetSquare: string): boolean => {
      if (!user) return false;
      const board = displayBoards.find((b) => b.id === boardId);
      const isMySeat =
        board &&
        (board.id === myPlayer?.boardId || board.playerUid === user.uid);
      if (!isMySeat) return false;
      if (board.boardStatus && board.boardStatus !== "active") return false;

      const seatColor = getSeatColor(boardId as BoardSeatId);
      const uci = `${sourceSquare}${targetSquare}`;
      const promotion = inferPromotion(board.fen, sourceSquare, targetSquare, seatColor);
      const validation = validateMove(board.fen, uci, seatColor, promotion);
      if (!validation.valid) return false;

      if (!applyOptimistic(boardId, uci, promotion)) return false;

      localMoveBoardRef.current = boardId;
      play(validation.capturedPiece ? "gameCapture" : "gameMove");

      void submitMove(match.id, boardId, user.uid, uci, undefined, undefined, promotion).catch(
        () => {
          clearOptimistic();
          toast.error("Move could not be saved. Try again.");
        }
      );

      return true;
    },
    [applyOptimistic, clearOptimistic, displayBoards, match.id, myPlayer?.boardId, play, user]
  );

  const handleDropSync = useCallback(
    (boardId: string, square: Square, piece?: PieceSymbol): boolean => {
      if (!user) return false;
      const dropPiece = piece ?? selectedPiece;
      if (!dropPiece) return false;

      const board = displayBoards.find((b) => b.id === boardId);
      const isMySeat =
        board &&
        (board.id === myPlayer?.boardId || board.playerUid === user.uid);
      if (!isMySeat) return false;
      if (board.boardStatus && board.boardStatus !== "active") return false;

      const reserve = board.captured as PieceSymbol[];
      if (!canDropPiece(reserve, dropPiece)) return false;

      const seatColor = getSeatColor(boardId as BoardSeatId);
      const validation = validateDrop(board.fen, dropPiece, square, seatColor, reserve);
      if (!validation.valid) return false;

      const move = `drop:${dropPiece}@${square}`;
      if (!applyOptimistic(boardId, move)) return false;

      localMoveBoardRef.current = boardId;
      play("gameDrop");

      void submitMove(match.id, boardId, user.uid, move).catch(() => {
        clearOptimistic();
        toast.error("Drop could not be saved. Try again.");
      });

      setSelectedPiece(null);
      return true;
    },
    [applyOptimistic, clearOptimistic, displayBoards, match.id, myPlayer?.boardId, play, selectedPiece, user]
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
    const isMine =
      board.id === myPlayer?.boardId || board.playerUid === user?.uid;
    const isPartner = board.id === myBoard?.partnerBoardId;
    const player = match.players.find((p) => p.uid === board.playerUid);
    // The opponent shares this physical board on the opposite color seat.
    const opponentSeatId = getMirrorSeats(board.id as BoardSeatId).find(
      (s) => s !== board.id
    );
    const opponentBoard = boards.find((b) => b.id === opponentSeatId);
    const opponentPlayer =
      match.players.find((p) => p.boardId === opponentSeatId) ??
      match.players.find((p) => p.uid === opponentBoard?.playerUid);
    const boardLabel = isMine ? "Your board" : isPartner ? "Partner board" : "Board";
    const frozen = board.boardStatus === "stalemate";
    const clocks = getBoardClocks(board.id);

    return (
      <ArenaBoardPanel
        key={board.id}
        board={board}
        player={player}
        opponentPlayer={opponentPlayer}
        opponentCaptured={opponentBoard?.captured ?? []}
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
        onDropPiece={(square, piece) => handleDropSync(board.id, square, piece)}
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
                <div className="flex gap-4 text-sm flex-wrap">
                  {(["w", "b"] as const).map((color) => {
                    const player = getPhysicalSeatPlayer(physicalId, color);
                    const time = color === "w" ? clocks.white : clocks.black;
                    const running =
                      color === "w" ? clocks.whiteRunning : clocks.blackRunning;
                    return (
                      <p
                        key={color}
                        className={`font-heading text-lg tabular-nums ${
                          running ? "text-primary neon-glow" : ""
                        }`}
                      >
                        <span className="font-medium">
                          {player?.displayName ?? (color === "w" ? "White" : "Black")}
                        </span>{" "}
                        {formatClock(time)}
                      </p>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex gap-2">
          <Badge>
            {match.mode}
            {match.mode === "casual"
              ? ` · ${formatTimeControl(matchTimeControlSeconds(match))}`
              : null}
          </Badge>
          <BoardThemeSelector compact />
          <PieceSetSelector compact />
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
          <MatchTeamChatDock
            matchId={match.id}
            team={myTeam}
            myUid={user.uid}
            myDisplayName={profile.displayName}
            disabled={match.status !== "active"}
          />
        ) : null}
      </div>

      {Array.from(remoteStreams.entries()).map(([peerId, stream]) => (
        <audio
          key={peerId}
          autoPlay
          ref={(el) => {
            if (el && el.srcObject !== stream) el.srcObject = stream;
          }}
        />
      ))}
    </div>
  );
}
