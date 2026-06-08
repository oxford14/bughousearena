"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { PartyPanel } from "@/components/arena/party-panel";
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
  clearUserQueueEntries,
  joinQueue,
  leaveQueue,
  subscribeToQueue,
} from "@/lib/game/matchmaking";
import {
  canQueueParty,
  clearPartyReady,
  subscribeToUserParty,
} from "@/lib/social/party";
import type { PartyDocument } from "@/types/firestore";
import { toast } from "sonner";
import { useSound } from "@/providers/sound-provider";
import { useLobbyMusic } from "@/hooks/use-lobby-music";
import { dismissLobbyMusic } from "@/lib/sound/music-manager";
import {
  CASUAL_TIME_CONTROLS,
  getCasualTimeControlLabel,
  STANDARD_TIME_CONTROL_SEC,
  type CasualTimeControlSec,
} from "@/lib/game/time-control";

export default function LobbyPage() {
  const { profile, user } = useAuth();
  const searchParams = useSearchParams();
  const { play } = useSound();
  useLobbyMusic();
  const cancelToastShown = useRef(false);
  const [party, setParty] = useState<(PartyDocument & { id: string }) | null>(null);
  const [queueId, setQueueId] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [activeMode, setActiveMode] = useState<MatchMode>("casual");
  const [queueElapsedSec, setQueueElapsedSec] = useState(0);
  const [liveHumansInQueue, setLiveHumansInQueue] = useState(0);
  const [casualTimeControl, setCasualTimeControl] = useState<CasualTimeControlSec>(
    STANDARD_TIME_CONTROL_SEC
  );
  const matchFoundRef = useRef(false);
  const queueUnsubRef = useRef<(() => void) | null>(null);
  const queueIdRef = useRef<string | null>(null);
  const botFailToastRef = useRef(false);

  const onMatchFoundFromQueue = useCallback(() => {
    if (matchFoundRef.current) return;
    matchFoundRef.current = true;
    queueUnsubRef.current?.();
    queueUnsubRef.current = null;
    setSearching(false);
    dismissLobbyMusic(500);
    if (party) void clearPartyReady(party.id);
    // ActiveMatchListener routes via users/{uid}/session/active.
  }, [party]);

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
    void clearUserQueueEntries(user.uid);
    return subscribeToUserParty(user.uid, setParty);
  }, [user]);

  useEffect(() => {
    if (searchParams.get("shop") !== "cancelled") return;
    if (cancelToastShown.current) return;
    cancelToastShown.current = true;
    toast.message("Purchase cancelled");
  }, [searchParams]);

  useEffect(() => {
    queueIdRef.current = queueId;
  }, [queueId]);

  useEffect(() => {
    return () => {
      queueUnsubRef.current?.();
      queueUnsubRef.current = null;
      const id = queueIdRef.current;
      if (id) void leaveQueue(id);
    };
  }, []);

  useEffect(() => {
    if (!searching) return;
    const onLeave = () => {
      const id = queueIdRef.current;
      if (id) void leaveQueue(id);
    };
    window.addEventListener("pagehide", onLeave);
    return () => window.removeEventListener("pagehide", onLeave);
  }, [searching]);

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
      const id = await joinQueue(
        profile,
        mode,
        party,
        mode === "casual" ? casualTimeControl : undefined
      );
      setQueueId(id);
      queueUnsubRef.current = subscribeToQueue(
        profile.uid,
        mode,
        id,
        () => {
          onMatchFoundFromQueue();
        },
        () => {
          if (botFailToastRef.current) return;
          botFailToastRef.current = true;
          toast.error("Could not start a bot match. Cancel and try again.");
        },
        ({ liveHumans }) => setLiveHumansInQueue(liveHumans)
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
    if (party) {
      await clearPartyReady(party.id);
    }
    setSearching(false);
    matchFoundRef.current = false;
    setLiveHumansInQueue(0);
  };

  const queueLabelBase =
    party && party.members.length === 2
      ? "Searching as party — pairing with other players"
      : party && party.members.length === 1
        ? "Searching — pairing partner"
        : "Searching for live opponents";

  const queueLabel =
    searching && liveHumansInQueue > 0
      ? `${queueLabelBase} (${liveHumansInQueue} in queue)`
      : searching && activeMode === "casual"
        ? `${queueLabelBase} · ${getCasualTimeControlLabel(casualTimeControl)}`
        : queueLabelBase;

  const leaderHint = "Only the party leader can start matchmaking.";

  return (
    <>
      <QueueRadar
        active={searching}
        label={queueLabel}
        elapsedSec={queueElapsedSec}
        onCancel={cancelQueue}
      />

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
                description="Unranked 4-player bughouse. Pick a time control, party up, or queue solo."
                iconSrc="/assets/lobby/mode-casual.svg"
                accentClass="lobby-mode-card--casual"
                searching={searching}
                queueLabel={queueLabel}
                queueElapsedSec={queueElapsedSec}
                canQueue={canQueue}
                disabledReason={leaderHint}
                timeControlOptions={CASUAL_TIME_CONTROLS}
                selectedTimeControl={casualTimeControl}
                onTimeControlChange={(seconds) => {
                  play("uiTab");
                  setCasualTimeControl(seconds as CasualTimeControlSec);
                }}
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
