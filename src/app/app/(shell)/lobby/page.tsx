"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronDown, Info } from "lucide-react";
import { PartyPanel } from "@/components/arena/party-panel";
import { LobbyScene } from "@/components/arena/lobby/lobby-scene";
import { LobbyHeader } from "@/components/arena/lobby/lobby-header";
import { QueueRadar } from "@/components/arena/lobby/queue-radar";
import {
  MatchModePanel,
  type MatchMode,
} from "@/components/arena/lobby/match-mode-panel";
import { MatchModeCarousel } from "@/components/arena/lobby/match-mode-carousel";
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
  leaveParty,
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
import { STAKE_TIERS, getStakeWinPayout } from "@/lib/wallet/stake-tiers";
import { joinStakeQueue, leaveStakeQueue } from "@/lib/wallet/wallet-api";
import type { MatchMode as FirestoreMatchMode } from "@/types/firestore";
import {
  CRAZYHOUSE_HOWTO,
  ATOMIC_HOWTO,
  GAME_TYPE_STORAGE_KEY,
  GAME_TYPES,
  getGameTypeMeta,
  isSoloMatchContext,
  normalizeGameType,
  parseGameTypeParam,
  type ChessGameType,
} from "@/lib/game/game-types";
import { cn } from "@/lib/utils";

const ONE_V_ONE_MODES: MatchMode[] = ["casual", "stake", "private"];

export default function LobbyPage() {
  const { profile, user } = useAuth();
  const searchParams = useSearchParams();
  const { play } = useSound();
  useLobbyMusic();
  const cancelToastShown = useRef(false);
  const [party, setParty] = useState<(PartyDocument & { id: string }) | null>(null);
  const [queueId, setQueueId] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [gameType, setGameType] = useState<ChessGameType>("bughouse");
  const [activeMode, setActiveMode] = useState<MatchMode>("casual");
  const [queueElapsedSec, setQueueElapsedSec] = useState(0);
  const [liveHumansInQueue, setLiveHumansInQueue] = useState(0);
  const [casualTimeControl, setCasualTimeControl] = useState<CasualTimeControlSec>(
    STANDARD_TIME_CONTROL_SEC
  );
  const [stakeTier, setStakeTier] = useState<number>(STAKE_TIERS[0]!);
  const matchFoundRef = useRef(false);
  const queueUnsubRef = useRef<(() => void) | null>(null);
  const queueIdRef = useRef<string | null>(null);
  const botFailToastRef = useRef(false);
  const partyRef = useRef(party);
  partyRef.current = party;

  const onMatchFoundFromQueue = useCallback(() => {
    if (matchFoundRef.current) return;
    matchFoundRef.current = true;
    queueUnsubRef.current?.();
    queueUnsubRef.current = null;
    setSearching(false);
    dismissLobbyMusic(500);
    if (party) void clearPartyReady(party.id);
  }, [party]);

  const disbandPartyForSolo = useCallback(
    async (reason: string) => {
      const current = partyRef.current;
      if (!current || !user) return;
      if (current.members.length <= 1 && current.memberUids.length <= 1) {
        // Still leave so empty parties clear
      }
      try {
        await leaveParty(current.id, user.uid);
        toast.message(reason);
      } catch {
        // ignore
      }
    },
    [user]
  );

  // Restore game type from URL / session
  useEffect(() => {
    const fromUrl = parseGameTypeParam(searchParams.get("gameType"));
    if (fromUrl) {
      setGameType(fromUrl);
      try {
        sessionStorage.setItem(GAME_TYPE_STORAGE_KEY, fromUrl);
      } catch {
        /* ignore */
      }
      return;
    }
    try {
      const stored = sessionStorage.getItem(GAME_TYPE_STORAGE_KEY);
      if (stored) setGameType(normalizeGameType(stored));
    } catch {
      /* ignore */
    }
  }, [searchParams]);

  // Auto-disband when entering solo context
  useEffect(() => {
    if (searching) return;
    if (!isSoloMatchContext(gameType, activeMode)) return;
    if (!party || party.members.length === 0) return;
    void disbandPartyForSolo("Party disbanded — this mode is solo only.");
  }, [gameType, activeMode, party, searching, disbandPartyForSolo]);

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

  // Clamp mode when switching game type
  useEffect(() => {
    const allowed = getGameTypeMeta(gameType).matchModes;
    if (!allowed.includes(activeMode)) {
      setActiveMode("casual");
    }
  }, [gameType, activeMode]);

  const canQueue = canQueueParty(party, user?.uid ?? "");
  const isBughouse = gameType === "bughouse";
  const showParty = isBughouse;

  const handleGameTypeChange = (next: ChessGameType) => {
    if (searching) return;
    play("uiTab");
    setGameType(next);
    try {
      sessionStorage.setItem(GAME_TYPE_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    if (next !== "bughouse") {
      setActiveMode("casual");
    }
  };

  const handleModeChange = (mode: MatchMode) => {
    if (searching) return;
    play("uiTab");
    setActiveMode(mode);
  };

  const startQueue = async (mode: MatchMode) => {
    if (!profile || !user) return;
    if (!canQueueParty(party, user.uid) && isBughouse) return;

    if (isSoloMatchContext(gameType, mode) && party && party.members.length > 1) {
      await disbandPartyForSolo("Party disbanded — this mode is solo only.");
    }

    if (mode === "stake") {
      const partySize =
        !isSoloMatchContext(gameType, mode) && party && party.members.length > 1
          ? party.members.length
          : 1;
      const confirmed = window.confirm(
        partySize > 1
          ? `Each party member stakes ${stakeTier} coins. If you lose, stakes are forfeited. Winners receive ~${getStakeWinPayout(stakeTier)} coins each. Continue?`
          : `Stake ${stakeTier} coins to enter. If you lose, your stake is forfeited. Winners receive ~${getStakeWinPayout(stakeTier)} coins each. Continue?`
      );
      if (!confirmed) return;
    }

    matchFoundRef.current = false;
    botFailToastRef.current = false;
    play("uiClick");
    setSearching(true);
    setActiveMode(mode);
    try {
      const id = await joinQueue(
        profile,
        mode as FirestoreMatchMode,
        isSoloMatchContext(gameType, mode) ? null : party,
        mode === "casual" ? casualTimeControl : undefined,
        mode === "stake" ? stakeTier : undefined,
        gameType
      );

      if (mode === "stake") {
        try {
          await joinStakeQueue(stakeTier, id);
        } catch (stakeError) {
          await leaveQueue(id);
          throw stakeError;
        }
      }

      setQueueId(id);
      queueUnsubRef.current = subscribeToQueue(
        profile.uid,
        mode as FirestoreMatchMode,
        id,
        () => {
          onMatchFoundFromQueue();
        },
        () => {
          if (mode === "stake") return;
          if (botFailToastRef.current) return;
          botFailToastRef.current = true;
          toast.error("Could not start a bot match. Cancel and try again.");
        },
        ({ liveHumans }) => setLiveHumansInQueue(liveHumans),
        gameType
      );
    } catch (error) {
      play("uiError");
      toast.error(
        error instanceof Error ? error.message : "Failed to join queue."
      );
      setSearching(false);
    }
  };

  const cancelQueue = async () => {
    play("uiTab");
    queueUnsubRef.current?.();
    queueUnsubRef.current = null;
    if (activeMode === "stake") {
      await leaveStakeQueue(queueId ?? undefined).catch(() => {});
    }
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
    party && party.members.length === 2 && isBughouse
      ? "Searching as party — pairing with other players"
      : "Searching for live opponents";

  const queueLabel =
    searching && liveHumansInQueue > 0
      ? `${queueLabelBase} (${liveHumansInQueue} in queue)`
      : searching && activeMode === "casual"
        ? `${queueLabelBase} · ${getCasualTimeControlLabel(casualTimeControl)}`
        : queueLabelBase;

  const leaderHint = "Only the party leader can start matchmaking.";
  const gameMeta = getGameTypeMeta(gameType);
  const privateHref = `/app/private?gameType=${gameType}`;

  const renderModePanel = (mode: MatchMode) => {
    if (mode === "casual") {
      return (
        <MatchModePanel
          mode="casual"
          title={
            isBughouse
              ? "Casual Match"
              : `Casual ${gameMeta.shortLabel}`
          }
          description={
            isBughouse
              ? "Unranked 4-player bughouse. Pick a time control, party up, or queue solo."
              : `Unranked 1v1 ${gameMeta.shortLabel}. Pick a time control and find a match.`
          }
          iconSrc="/assets/lobby/mode-casual.svg"
          accentClass="lobby-mode-card--casual"
          searching={searching}
          queueLabel={queueLabel}
          queueElapsedSec={queueElapsedSec}
          canQueue={isBughouse ? canQueue : Boolean(user)}
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
      );
    }
    if (mode === "ranked") {
      return (
        <MatchModePanel
          mode="ranked"
          title="Ranked Match"
          description="ELO-rated bughouse. Party members share a team; solos are auto-paired."
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
      );
    }
    if (mode === "stake") {
      return (
        <MatchModePanel
          mode="stake"
          title="Stake Match"
          description="Competitive matches with an entry stake. Win to earn the purse — no bots, humans only."
          iconSrc="/assets/lobby/mode-ranked.svg"
          accentClass="lobby-mode-card--ranked"
          searching={searching}
          queueLabel={queueLabel}
          queueElapsedSec={queueElapsedSec}
          canQueue={isBughouse ? canQueue : Boolean(user)}
          disabledReason={leaderHint}
          stakeTierOptions={STAKE_TIERS}
          selectedStakeTier={stakeTier}
          onStakeTierChange={(amount) => {
            play("uiTab");
            setStakeTier(amount);
          }}
          onQueue={() => startQueue("stake")}
          onCancel={cancelQueue}
        />
      );
    }
    return (
      <MatchModePanel
        mode="private"
        title="Private Room"
        description={`Create or join a private ${gameMeta.shortLabel} room with a 6-character code.`}
        iconSrc="/assets/lobby/mode-private.svg"
        accentClass="lobby-mode-card--private"
        searching={false}
        queueLabel=""
        canQueue={false}
        onQueue={() => {}}
        onCancel={() => {}}
        privateHref={privateHref}
      />
    );
  };

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

          <div>
            <label
              htmlFor="game-type"
              className="mb-1.5 block text-[10px] uppercase tracking-wider text-muted-foreground"
            >
              Game mode
            </label>
            <div className="relative">
              <select
                id="game-type"
                value={gameType}
                disabled={searching}
                onChange={(e) =>
                  handleGameTypeChange(e.target.value as ChessGameType)
                }
                className="w-full appearance-none rounded-xl border border-primary/25 bg-card/60 px-4 py-3 pr-10 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 cursor-pointer disabled:opacity-50"
              >
                {GAME_TYPES.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {gameMeta.description}
            </p>
          </div>

          {gameType === "crazyhouse" ? (
            <div className="rounded-xl border border-secondary/30 bg-secondary/5 p-4">
              <p className="mb-2 flex items-center gap-2 text-sm font-medium text-secondary">
                <Info className="h-4 w-4" />
                {CRAZYHOUSE_HOWTO.title}
              </p>
              <ul className="space-y-1.5 text-xs text-muted-foreground">
                {CRAZYHOUSE_HOWTO.points.map((p) => (
                  <li key={p} className="flex gap-2">
                    <span className="text-secondary">•</span>
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {gameType === "atomic" ? (
            <div className="rounded-xl border border-secondary/30 bg-secondary/5 p-4">
              <p className="mb-2 flex items-center gap-2 text-sm font-medium text-secondary">
                <Info className="h-4 w-4" />
                {ATOMIC_HOWTO.title}
              </p>
              <ul className="space-y-1.5 text-xs text-muted-foreground">
                {ATOMIC_HOWTO.points.map((p) => (
                  <li key={p} className="flex gap-2">
                    <span className="text-secondary">•</span>
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {showParty ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.4 }}
            >
              <PartyPanel searching={searching} />
            </motion.div>
          ) : null}

          <section>
            {isBughouse ? (
              <>
                <MatchModeCarousel
                  activeMode={activeMode}
                  onModeChange={handleModeChange}
                  disabled={searching}
                />
                {renderModePanel(activeMode)}
              </>
            ) : (
              <>
                <div className="mb-4 grid grid-cols-3 gap-2 rounded-xl border border-primary/20 bg-muted/20 p-1.5">
                  {ONE_V_ONE_MODES.map((m) => {
                    const active = activeMode === m;
                    const label =
                      m === "casual"
                        ? "Casual"
                        : m === "stake"
                          ? "Stake"
                          : "Private";
                    return (
                      <button
                        key={m}
                        type="button"
                        disabled={searching}
                        onClick={() => handleModeChange(m)}
                        className={cn(
                          "rounded-lg px-2 py-2.5 text-sm font-medium transition-colors cursor-pointer",
                          active
                            ? "bg-gradient-to-r from-primary to-accent text-primary-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                {renderModePanel(
                  ONE_V_ONE_MODES.includes(activeMode) ? activeMode : "casual"
                )}
              </>
            )}
          </section>
        </div>
      </LobbyScene>
    </>
  );
}
