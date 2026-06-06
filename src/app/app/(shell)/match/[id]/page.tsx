"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { BughouseArena } from "@/components/game/bughouse-arena";
import { MatchResultScreen } from "@/components/game/match-result-screen";
import { MatchSetupPhase } from "@/components/game/match-setup-phase";
import { subscribeToMatchAndBoards } from "@/lib/game/sync-manager";
import { useAuth } from "@/providers/auth-provider";
import { useSound } from "@/providers/sound-provider";
import type { BoardDocument, MatchDocument } from "@/types/firestore";

export default function MatchPage() {
  const params = useParams();
  const matchId = params.id as string;
  const { user, profile } = useAuth();
  const { play } = useSound();
  const matchStartedRef = useRef(false);
  const [match, setMatch] = useState<MatchDocument | null>(null);
  const [boards, setBoards] = useState<BoardDocument[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!matchId) return;
    const unsub = subscribeToMatchAndBoards(matchId, {
      onMatch: (m) => {
        setMatch(m);
        setLoading(false);
      },
      onBoards: setBoards,
    });
    return unsub;
  }, [matchId]);

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
      <div className="text-center py-12">
        <p className="text-muted-foreground">Match not found.</p>
      </div>
    );
  }

  const inSetup = match.status === "setup";
  const isCompleted = match.status === "completed";
  const isParticipant = Boolean(user && match.playerUids?.includes(user.uid));

  if (isCompleted) {
    return (
      <MatchResultScreen match={match} boards={boards} userUid={user?.uid} />
    );
  }

  return (
    <>
      {inSetup && isParticipant && user && profile ? (
        <MatchSetupPhase
          match={match}
          myUid={user.uid}
          myDisplayName={profile.displayName}
        />
      ) : inSetup ? (
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center space-y-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
            <p className="text-sm text-muted-foreground">Match starting soon…</p>
          </div>
        </div>
      ) : (
        <BughouseArena match={match} boards={boards} />
      )}
    </>
  );
}
