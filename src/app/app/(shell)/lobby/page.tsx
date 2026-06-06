"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { PartyPanel } from "@/components/arena/party-panel";
import { MatchFoundOverlay } from "@/components/arena/match-found-overlay";
import { LobbyScene } from "@/components/arena/lobby/lobby-scene";
import { LobbyHeader } from "@/components/arena/lobby/lobby-header";
import { QueueRadar } from "@/components/arena/lobby/queue-radar";
import {
  MatchModePanel,
  MatchModeTabs,
  type MatchMode,
} from "@/components/arena/lobby/match-mode-panel";
import { useAuth } from "@/providers/auth-provider";
import {
  clearActiveMatchSession,
  joinQueue,
  leaveQueue,
  subscribeToActiveMatch,
  subscribeToQueue,
} from "@/lib/game/matchmaking";
import { canQueueParty, subscribeToUserParty } from "@/lib/social/party";
import type { PartyDocument } from "@/types/firestore";
import { toast } from "sonner";
import { useSound } from "@/providers/sound-provider";
import { useLobbyMusic } from "@/hooks/use-lobby-music";
import { playMatchFoundMusic, dismissLobbyMusic } from "@/lib/sound/music-manager";

interface MatchTransition {
  matchId: string;
  subtitle?: string;
}

export default function LobbyPage() {
  const { profile, user } = useAuth();
  const router = useRouter();
  const { play } = useSound();
  useLobbyMusic();
  const [party, setParty] = useState<(PartyDocument & { id: string }) | null>(null);
  const [queueId, setQueueId] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [activeMode, setActiveMode] = useState<MatchMode>("casual");
  const [matchTransition, setMatchTransition] = useState<MatchTransition | null>(null);
  const [queueElapsedSec, setQueueElapsedSec] = useState(0);
  const matchFoundRef = useRef(false);
  const queueUnsubRef = useRef<(() => void) | null>(null);
  const botFailToastRef = useRef(false);

  const beginMatchTransition = useCallback(
    (matchId: string, options?: { usedBots?: boolean }) => {
      if (matchFoundRef.current) return;
      matchFoundRef.current = true;
      queueUnsubRef.current?.();
      queueUnsubRef.current = null;
      setSearching(false);
      dismissLobbyMusic(500);
      play("matchFound");
      playMatchFoundMusic();
      setMatchTransition({
        matchId,
        subtitle: options?.usedBots ? "Opponents filled with arena bots" : undefined,
      });
    },
    [play]
  );

  useEffect(() => {
    if (!searching) {
      setQueueElapsedSec(0);
      return;
    }
    const tick = window.setInterval(() => {
      setQueueElapsedSec((sec) => sec + 1);
    }, 1000);
    return () => window.clearInterval(tick);
  }, [searching]);

  useEffect(() => {
    if (!user) return;
    return subscribeToUserParty(user.uid, setParty);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    void clearActiveMatchSession(user.uid);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    return subscribeToActiveMatch(user.uid, (matchId) => beginMatchTransition(matchId));
  }, [user, beginMatchTransition]);

  useEffect(() => {
    if (!searching) return;
    play("uiClick");
    const interval = window.setInterval(() => play("queuePulse"), 2400);
    return () => window.clearInterval(interval);
  }, [searching, play]);

  const canQueue = canQueueParty(party, user?.uid ?? "");

  const startQueue = async (mode: "casual" | "ranked") => {
    if (!profile || !canQueue) return;
    matchFoundRef.current = false;
    botFailToastRef.current = false;
    play("uiClick");
    setSearching(true);
    setActiveMode(mode);
    try {
      const id = await joinQueue(profile, mode, party);
      setQueueId(id);
      queueUnsubRef.current = subscribeToQueue(
        profile.uid,
        mode,
        id,
        (matchId, options) => {
          beginMatchTransition(matchId, options);
        },
        () => {
          if (botFailToastRef.current) return;
          botFailToastRef.current = true;
          toast.error("Could not start a bot match. Cancel and try again.");
        }
      );
    } catch {
      play("uiError");
      toast.error("Failed to join queue.");
      setSearching(false);
    }
  };

  const cancelQueue = async () => {
    play("uiTab");
    queueUnsubRef.current?.();
    queueUnsubRef.current = null;
    if (queueId) {
      await leaveQueue(queueId);
      setQueueId(null);
    }
    setSearching(false);
    matchFoundRef.current = false;
  };

  const queueLabel =
    party && party.members.length === 2
      ? "Searching as party (2)"
      : party && party.members.length === 1
        ? "Searching — pairing partner"
        : "Scanning for opponents";

  const leaderHint = "Only the party leader can start matchmaking.";

  return (
    <>
      <QueueRadar
        active={searching && !matchTransition}
        label={queueLabel}
        elapsedSec={queueElapsedSec}
      />

      <AnimatePresence>
        {matchTransition ? (
          <MatchFoundOverlay
            subtitle={matchTransition.subtitle}
            onComplete={() => router.push(`/app/match/${matchTransition.matchId}`)}
          />
        ) : null}
      </AnimatePresence>

      <LobbyScene>
        <div className="mx-auto max-w-4xl space-y-6 pb-8">
          <LobbyHeader profile={profile} />

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.4 }}
          >
            <PartyPanel searching={searching} />
          </motion.div>

          <section>
            <MatchModeTabs
              activeMode={activeMode}
              onModeChange={(mode) => {
                if (searching) return;
                play("uiTab");
                setActiveMode(mode);
              }}
            />

            {activeMode === "casual" && (
              <MatchModePanel
                mode="casual"
                title="Casual Match"
                description="Unranked 4-player bughouse. Party up or queue solo — teams are formed automatically."
                iconSrc="/assets/lobby/mode-casual.svg"
                accentClass="lobby-mode-card--casual"
                searching={searching}
                queueLabel={queueLabel}
                queueElapsedSec={queueElapsedSec}
                canQueue={canQueue}
                disabledReason={leaderHint}
                onQueue={() => startQueue("casual")}
                onCancel={cancelQueue}
              />
            )}

            {activeMode === "ranked" && (
              <MatchModePanel
                mode="ranked"
                title="Ranked Match"
                description="ELO-rated matches. Party members share a team; solos are auto-paired."
                iconSrc="/assets/lobby/mode-ranked.svg"
                accentClass="lobby-mode-card--ranked"
                searching={searching}
                queueLabel={queueLabel}
                queueElapsedSec={queueElapsedSec}
                canQueue={canQueue}
                disabledReason={leaderHint}
                onQueue={() => startQueue("ranked")}
                onCancel={cancelQueue}
              />
            )}

            {activeMode === "private" && (
              <MatchModePanel
                mode="private"
                title="Private Room"
                description="Create or join a private room with a 6-character code."
                iconSrc="/assets/lobby/mode-private.svg"
                accentClass="lobby-mode-card--private"
                searching={false}
                queueLabel=""
                canQueue={false}
                onQueue={() => {}}
                onCancel={() => {}}
                privateHref="/app/private"
              />
            )}
          </section>
        </div>
      </LobbyScene>
    </>
  );
}
