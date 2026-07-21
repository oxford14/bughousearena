"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BughouseArena } from "@/components/game/bughouse-arena";
import { SingleBoardArena } from "@/components/game/single-board-arena";
import { MatchResultScreen } from "@/components/game/match-result-screen";
import { MatchSetupPhase } from "@/components/game/match-setup-phase";
import { SingleBoardSetupPhase } from "@/components/game/single-board-setup-phase";
import { subscribeToMatchAndBoards } from "@/lib/game/sync-manager";
import { clearActiveMatchSession } from "@/lib/game/matchmaking";
import { normalizeGameType } from "@/lib/game/game-types";
import { useAuth } from "@/providers/auth-provider";
import { useSound } from "@/providers/sound-provider";
import type { BoardDocument, MatchDocument } from "@/types/firestore";

export default function MatchPage() {
  const params = useParams();
  const router = useRouter();
  const matchId = params.id as string;
  const { user, profile } = useAuth();
  const { play } = useSound();
  const matchStartedRef = useRef(false);
  const sessionClearedRef = useRef(false);
  const [match, setMatch] = useState<MatchDocument | null>(null);
  const [boards, setBoards] = useState<BoardDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadTimedOut, setLoadTimedOut] = useState(false);

  useEffect(() => {
    if (!matchId) return;

    let cancelled = false;
    const timeout = window.setTimeout(() => {
      if (!cancelled) {
        setLoadTimedOut(true);
        setLoading(false);
      }
    }, 15000);

    const unsub = subscribeToMatchAndBoards(matchId, {
      onMatch: (m) => {
        if (cancelled) return;
        if (m) {
          setMatch(m);
          setLoadTimedOut(false);
          setLoading(false);
          window.clearTimeout(timeout);
          return;
        }
        // Keep the last known match while the listener reconnects — avoids
        // flashing "not found" when navigating back from the lobby tab.
        setMatch((prev) => prev ?? null);
      },
      onBoards: setBoards,
    });

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      unsub();
    };
  }, [matchId]);

  useEffect(() => {
    sessionClearedRef.current = false;
  }, [matchId]);

  useEffect(() => {
    if (!user || !match || sessionClearedRef.current) return;
    if (!match.playerUids?.includes(user.uid)) return;
    sessionClearedRef.current = true;
    void clearActiveMatchSession(user.uid);
  }, [match, user]);

  useEffect(() => {
    if (match?.status === "active" && !matchStartedRef.current) {
      matchStartedRef.current = true;
      play("matchStart");
    }
  }, [match, play]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!match) {
    return (
      <div className="text-center py-12 space-y-4">
        <p className="text-muted-foreground">
          {loadTimedOut
            ? "This match could not be loaded. It may have expired or failed to start."
            : "Loading match…"}
        </p>
        {loadTimedOut ? (
          <Button
            className="cursor-pointer"
            onClick={() => router.push("/app/lobby")}
          >
            Back to Lobby
          </Button>
        ) : (
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
        )}
      </div>
    );
  }

  const inSetup = match.status === "setup";
  const isCompleted = match.status === "completed";
  const isParticipant = Boolean(user && match.playerUids?.includes(user.uid));
  const gameType = normalizeGameType(match.gameType);
  const isBughouse = gameType === "bughouse";

  if (isCompleted) {
    return (
      <MatchResultScreen match={match} boards={boards} userUid={user?.uid} />
    );
  }

  return (
    <>
      {inSetup && isParticipant && user && profile ? (
        isBughouse ? (
          <MatchSetupPhase
            match={match}
            myUid={user.uid}
            myDisplayName={profile.displayName}
          />
        ) : (
          <SingleBoardSetupPhase match={match} myUid={user.uid} />
        )
      ) : inSetup ? (
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center space-y-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
            <p className="text-sm text-muted-foreground">Match starting soon…</p>
          </div>
        </div>
      ) : isBughouse ? (
        <BughouseArena match={match} boards={boards} />
      ) : (
        <SingleBoardArena match={match} boards={boards} />
      )}
    </>
  );
}
