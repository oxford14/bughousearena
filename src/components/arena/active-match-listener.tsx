"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { MatchFoundOverlay } from "@/components/arena/match-found-overlay";
import {
  clearActiveMatchSession,
  reconcileActiveMatchSession,
  subscribeToActiveMatch,
} from "@/lib/game/matchmaking";
import { waitForMatchDocument } from "@/lib/game/sync-manager";
import { useAuth } from "@/providers/auth-provider";
import { useSound } from "@/providers/sound-provider";
import { playMatchFoundMusic, dismissLobbyMusic } from "@/lib/sound/music-manager";
import { toast } from "sonner";

interface MatchTransition {
  matchId: string;
  subtitle?: string;
}

/**
 * Routes the player into an active match once (session doc) without re-firing
 * when they revisit the lobby mid-game.
 */
export function ActiveMatchListener() {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { play } = useSound();
  const [matchTransition, setMatchTransition] = useState<MatchTransition | null>(null);
  const handledMatchIdsRef = useRef(new Set<string>());
  const pendingRef = useRef(false);

  const beginMatchTransition = useCallback(
    (matchId: string, options?: { usedBots?: boolean }) => {
      if (!matchId || pendingRef.current) return;
      if (handledMatchIdsRef.current.has(matchId)) return;

      if (pathname.startsWith("/app/match/")) {
        const currentId = pathname.split("/").pop();
        if (currentId === matchId && user) {
          void clearActiveMatchSession(user.uid);
          handledMatchIdsRef.current.add(matchId);
          return;
        }
      }

      pendingRef.current = true;
      dismissLobbyMusic(500);
      play("matchFound");
      playMatchFoundMusic();

      void waitForMatchDocument(matchId).then((ready) => {
        pendingRef.current = false;
        if (!ready) {
          toast.error("Match could not be loaded. Please find a match again.");
          if (user) void clearActiveMatchSession(user.uid);
          handledMatchIdsRef.current.delete(matchId);
          return;
        }
        handledMatchIdsRef.current.add(matchId);
        setMatchTransition({
          matchId,
          subtitle: options?.usedBots
            ? "Opponents filled with arena bots"
            : "Matched with other players",
        });
      });
    },
    [pathname, play, user]
  );

  useEffect(() => {
    if (!user) return;

    void reconcileActiveMatchSession(user.uid).then((matchId) => {
      if (!matchId) return;
      if (pathname === `/app/match/${matchId}`) {
        handledMatchIdsRef.current.add(matchId);
        return;
      }
      if (pathname.startsWith("/app/match/")) return;
      beginMatchTransition(matchId);
    });
  }, [user, pathname, beginMatchTransition]);

  useEffect(() => {
    if (!user) return;
    return subscribeToActiveMatch(user.uid, (matchId) => {
      beginMatchTransition(matchId);
    });
  }, [user, beginMatchTransition]);

  return (
    <AnimatePresence>
      {matchTransition ? (
        <MatchFoundOverlay
          subtitle={matchTransition.subtitle}
          onComplete={() => {
            if (!user) return;
            const { matchId } = matchTransition;
            setMatchTransition(null);
            void clearActiveMatchSession(user.uid);
            router.push(`/app/match/${matchId}`);
          }}
        />
      ) : null}
    </AnimatePresence>
  );
}
