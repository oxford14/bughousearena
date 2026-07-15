"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Image from "next/image";
import { Home, Trophy, Skull, RotateCcw } from "lucide-react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { VictoryConfetti } from "@/components/game/victory-confetti";
import { MatchResultBoard } from "@/components/game/match-result-board";
import {
  didPlayerWin,
  formatDuration,
  formatMatchEndReason,
  getDecisiveBoardLabel,
  getMatchEndReasonTitle,
  getPlayerTeam,
  matchDurationSeconds,
} from "@/lib/game/match-end";
import {
  getPhysicalBoardLabelForSeat,
  type BoardSeatId,
} from "@/lib/game/bughouse-engine";
import { dedupePlayersByUid, getTeamPlayers } from "@/lib/game/match-setup";
import { clearActiveMatchSession } from "@/lib/game/matchmaking";
import { applyRankedRatingForUser } from "@/lib/game/rating-service";
import { saveMatchHistory } from "@/lib/social/match-history";
import { getRankAssetPath, getRankTier } from "@/lib/game/elo";
import { isBotUid } from "@/lib/game/bots";
import { useAuth } from "@/providers/auth-provider";
import { useSound } from "@/providers/sound-provider";
import type { BoardDocument, MatchDocument } from "@/types/firestore";
import { cn } from "@/lib/utils";
import { getStakeWinPayout } from "@/lib/wallet/stake-tiers";
import { advanceTournamentMatch } from "@/lib/wallet/wallet-api";

interface MatchResultScreenProps {
  match: MatchDocument;
  boards: BoardDocument[];
  userUid?: string;
}

export function MatchResultScreen({ match, boards, userUid }: MatchResultScreenProps) {
  const router = useRouter();
  const { play } = useSound();
  const { refreshProfile } = useAuth();
  const historySavedRef = useRef(false);
  const soundPlayedRef = useRef(false);
  const [ratingChange, setRatingChange] = useState<number | null>(null);
  const [ratingReady, setRatingReady] = useState(false);

  const myTeam = userUid ? getPlayerTeam(match, userUid) : null;
  const won = userUid ? didPlayerWin(match, userUid) : null;
  const isVictory = won === true;
  const isDefeat = won === false;

  const teammates = useMemo(
    () => (myTeam ? getTeamPlayers(match.players, myTeam) : []),
    [match.players, myTeam]
  );
  const opponents = useMemo(() => {
    if (!myTeam) return dedupePlayersByUid(match.players);
    const oppTeam = myTeam === 1 ? 2 : 1;
    return getTeamPlayers(match.players, oppTeam).filter((p) => p.uid !== userUid);
  }, [match.players, myTeam, userUid]);

  const durationSec = matchDurationSeconds(match);
  const reasonTitle = getMatchEndReasonTitle(match, boards);
  const decisiveBoard = getDecisiveBoardLabel(match, boards);
  const endLabel = formatMatchEndReason(match, userUid, boards);

  useEffect(() => {
    if (soundPlayedRef.current) return;
    soundPlayedRef.current = true;
    if (isVictory) play("uiSuccess");
    else if (isDefeat) play("uiError");
  }, [isVictory, isDefeat, play]);

  useEffect(() => {
    if (!userUid || myTeam == null) return;

    if (match.mode !== "ranked") {
      setRatingChange(0);
      setRatingReady(true);
      return;
    }

    void applyRankedRatingForUser(match.id, userUid)
      .then((delta) => {
        setRatingChange(delta ?? 0);
        void refreshProfile();
      })
      .catch(() => setRatingChange(0))
      .finally(() => setRatingReady(true));
  }, [userUid, myTeam, match.id, match.mode, refreshProfile]);

  useEffect(() => {
    if (!match.tournamentId || !userUid) return;
    void advanceTournamentMatch(match.id)
      .then(() => refreshProfile())
      .catch(() => {});
  }, [match.id, match.tournamentId, userUid, refreshProfile]);

  useEffect(() => {
    if (match.stakePerPlayer && userUid) {
      void refreshProfile();
    }
  }, [match.stakePerPlayer, userUid, refreshProfile]);

  useEffect(() => {
    if (!userUid || myTeam == null || historySavedRef.current || !ratingReady) return;

    historySavedRef.current = true;

    void saveMatchHistory(userUid, {
      matchId: match.id,
      mode: match.mode,
      result: isVictory ? "win" : isDefeat ? "loss" : "draw",
      opponents: opponents.map((p) => p.displayName),
      duration: durationSec ?? 0,
      ratingChange: match.mode === "ranked" ? (ratingChange ?? 0) : 0,
    }).catch(() => {});
  }, [
    userUid,
    myTeam,
    match.id,
    match.mode,
    isVictory,
    isDefeat,
    opponents,
    durationSec,
    ratingChange,
    ratingReady,
  ]);

  const handleReturnLobby = async () => {
    play("uiNav");
    if (userUid) {
      await clearActiveMatchSession(userUid);
    }
    router.push("/app/lobby");
  };

  const headline = isVictory ? "Victory" : isDefeat ? "Defeat" : "Match Over";
  const Icon = isVictory ? Trophy : Skull;

  return (
    <div className="relative min-h-[70vh] flex items-center justify-center py-8 px-4">
      {isVictory && <VictoryConfetti active />}

      <motion.div
        className="relative z-10 w-full max-w-3xl"
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      >
        <div
          className={cn(
            "arena-card rounded-2xl border overflow-hidden",
            isVictory
              ? "border-emerald-500/40 shadow-[0_0_48px_rgba(16,185,129,0.15)]"
              : isDefeat
                ? "border-red-500/30 shadow-[0_0_32px_rgba(239,68,68,0.08)]"
                : "border-primary/25"
          )}
        >
          <div
            className={cn(
              "px-6 py-8 text-center border-b border-primary/15",
              isVictory
                ? "bg-gradient-to-b from-emerald-500/15 to-transparent"
                : isDefeat
                  ? "bg-gradient-to-b from-red-500/10 to-transparent"
                  : "bg-gradient-to-b from-primary/10 to-transparent"
            )}
          >
            <motion.div
              initial={{ scale: 0.6, rotate: -8 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.15, type: "spring", stiffness: 260, damping: 18 }}
              className={cn(
                "mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full",
                isVictory
                  ? "bg-emerald-500/20 text-emerald-400"
                  : isDefeat
                    ? "bg-red-500/15 text-red-400"
                    : "bg-primary/20 text-primary"
              )}
            >
              <Icon className="h-8 w-8" />
            </motion.div>

            <h1
              className={cn(
                "font-heading text-3xl md:text-4xl tracking-wide mb-2",
                isVictory && "neon-glow text-emerald-300",
                isDefeat && "text-red-300"
              )}
            >
              {headline}
            </h1>

            <p className="text-sm text-muted-foreground max-w-md mx-auto">{endLabel}</p>

            <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
              <Badge
                variant="outline"
                className={cn(
                  "text-xs font-semibold uppercase tracking-wide",
                  reasonTitle === "Checkmate" && "border-red-500/40 text-red-300",
                  reasonTitle === "Time forfeit" && "border-amber-500/40 text-amber-300",
                  reasonTitle === "Resignation" && "border-orange-500/40 text-orange-300"
                )}
              >
                {reasonTitle}
                {decisiveBoard ? ` · ${decisiveBoard}` : ""}
              </Badge>
              {match.stakePerPlayer ? (
                <Badge variant="outline" className="text-xs border-accent/40 text-accent">
                  Stake {match.stakePerPlayer} ·{" "}
                  {isVictory
                    ? `+${getStakeWinPayout(match.stakePerPlayer)} coins`
                    : isDefeat
                      ? "Stake lost"
                      : "Draw"}
                </Badge>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
              <Badge variant="secondary" className="capitalize">
                {match.mode}
              </Badge>
              {match.winnerTeam && (
                <Badge variant={isVictory ? "default" : "outline"}>
                  Team {match.winnerTeam} wins
                </Badge>
              )}
              <span className="text-xs text-muted-foreground tabular-nums">
                {formatDuration(durationSec)}
              </span>
              {match.mode === "ranked" && ratingReady && ratingChange != null && (
                <Badge
                  variant="outline"
                  className={cn(
                    "tabular-nums font-semibold",
                    ratingChange > 0
                      ? "border-emerald-500/40 text-emerald-300"
                      : ratingChange < 0
                        ? "border-red-500/40 text-red-300"
                        : "text-muted-foreground"
                  )}
                >
                  {ratingChange > 0 ? "+" : ""}
                  {ratingChange} ELO
                </Badge>
              )}
              {match.mode === "casual" && (
                <span className="text-xs text-muted-foreground">Unranked — no ELO change</span>
              )}
            </div>
          </div>

          <div className="px-6 py-5 space-y-4">
            {myTeam != null && (
              <>
                <section>
                  <p className="text-[10px] uppercase tracking-wider text-secondary mb-2">
                    Your team
                  </p>
                  <ul className="space-y-2">
                    {teammates.map((player) => (
                      <li
                        key={player.boardId || player.uid}
                        className="flex items-center gap-3 rounded-lg border border-primary/15 bg-muted/10 px-3 py-2"
                      >
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={player.photoURL ?? undefined} />
                          <AvatarFallback>{player.displayName[0]}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">
                            {player.displayName}
                            {player.uid === userUid ? (
                              <span className="text-muted-foreground font-normal"> (you)</span>
                            ) : null}
                            {isBotUid(player.uid) ? (
                              <span className="text-muted-foreground font-normal"> · Bot</span>
                            ) : null}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {getPhysicalBoardLabelForSeat(player.boardId as BoardSeatId)} · {player.rating} rating
                          </p>
                        </div>
                        <Image
                          src={getRankAssetPath(player.rankTier ?? getRankTier(player.rating))}
                          alt=""
                          width={22}
                          height={22}
                        />
                      </li>
                    ))}
                  </ul>
                </section>

                <section>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                    Opponents
                  </p>
                  <ul className="space-y-2">
                    {opponents.map((player) => (
                      <li
                        key={player.boardId || player.uid}
                        className="flex items-center gap-3 rounded-lg border border-primary/10 px-3 py-2 opacity-90"
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={player.photoURL ?? undefined} />
                          <AvatarFallback>{player.displayName[0]}</AvatarFallback>
                        </Avatar>
                        <span className="text-sm truncate flex-1">
                          {player.displayName}
                          <span className="text-muted-foreground">
                            {" "}
                            · {getPhysicalBoardLabelForSeat(player.boardId as BoardSeatId)}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              </>
            )}

            {boards.length > 0 && (
              <section>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-3">
                  Final positions
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <MatchResultBoard
                    physicalId="alpha"
                    match={match}
                    boards={boards}
                    players={match.players}
                  />
                  <MatchResultBoard
                    physicalId="bravo"
                    match={match}
                    boards={boards}
                    players={match.players}
                  />
                </div>
              </section>
            )}
          </div>

          <div className="px-6 pb-6 space-y-2">
            <Link
              href={`/app/match/${match.id}/replay`}
              className={cn(
                buttonVariants({ variant: "outline" }),
                "w-full cursor-pointer h-11 text-base inline-flex items-center justify-center"
              )}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Review match
            </Link>
            <Button
              className="w-full btn-arena-primary cursor-pointer h-11 text-base"
              onClick={() => void handleReturnLobby()}
            >
              <Home className="h-4 w-4 mr-2" />
              Return to Lobby
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
