"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Crown,
  Loader2,
  Lock,
  Trophy,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  collection,
  doc,
  onSnapshot,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/config";
import type {
  TournamentDocument,
  TournamentMember,
  TournamentTeam,
} from "@/types/wallet";
import { useAuth } from "@/providers/auth-provider";
import {
  joinTournamentRoom,
  startTournamentBracket,
  kickTournamentMember,
  leaveTournament,
  pruneTournament,
  TOURNAMENT_ENTRY_FEE,
  TOURNAMENT_MAX_PLAYERS,
} from "@/lib/wallet/tournament-client";
import { toast } from "sonner";
import Link from "next/link";

function normalizeSlots(
  slots: (string | null)[] | undefined,
  memberUids: string[],
  maxPlayers: number
): (string | null)[] {
  if (Array.isArray(slots) && slots.length === maxPlayers) {
    return slots.map((s) => (s ? s : null));
  }
  const result: (string | null)[] = Array.from(
    { length: maxPlayers },
    () => null
  );
  for (let i = 0; i < memberUids.length && i < maxPlayers; i++) {
    result[i] = memberUids[i]!;
  }
  return result;
}

function slotsMatch(
  a: (string | null)[],
  b: (string | null)[]
): boolean {
  if (a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

const TEAM_COUNT = TOURNAMENT_MAX_PLAYERS / 2;

export default function TournamentRoomContent({
  tournamentId,
}: {
  tournamentId: string;
}) {
  const { user, profile } = useAuth();
  const router = useRouter();
  const [tournament, setTournament] = useState<
    (TournamentDocument & { id: string }) | null
  >(null);
  const [members, setMembers] = useState<(TournamentMember & { id: string })[]>(
    []
  );
  const [teams, setTeams] = useState<(TournamentTeam & { id: string })[]>([]);
  const [pin, setPin] = useState("");
  const [joiningSlot, setJoiningSlot] = useState<number | null>(null);
  const [optimisticSlots, setOptimisticSlots] = useState<
    (string | null)[] | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!tournamentId) return;
    const unsub = onSnapshot(
      doc(getFirebaseDb(), "tournaments", tournamentId),
      (snap) => {
        setLoading(false);
        if (!snap.exists()) {
          setNotFound(true);
          setTournament(null);
          return;
        }
        setNotFound(false);
        const data = {
          ...(snap.data() as TournamentDocument),
          id: snap.id,
        };
        setTournament(data);

        const serverSlots = normalizeSlots(
          data.slots,
          data.memberUids ?? [],
          data.maxPlayers ?? TOURNAMENT_MAX_PLAYERS
        );
        setOptimisticSlots((prev) => {
          if (!prev) return null;
          return slotsMatch(prev, serverSlots) ? null : prev;
        });
      },
      () => {
        setLoading(false);
        setNotFound(true);
      }
    );
    return () => unsub();
  }, [tournamentId]);

  useEffect(() => {
    if (!tournamentId) return;
    const unsub = onSnapshot(
      collection(getFirebaseDb(), "tournaments", tournamentId, "members"),
      (snap) => {
        const list = snap.docs.map((d) => ({
          ...(d.data() as TournamentMember),
          id: d.id,
        }));
        list.sort((a, b) => (a.joinOrder ?? 0) - (b.joinOrder ?? 0));
        setMembers(list);
      }
    );
    return () => unsub();
  }, [tournamentId]);

  useEffect(() => {
    if (!tournamentId || tournament?.status === "registration") {
      setTeams([]);
      return;
    }
    const unsub = onSnapshot(
      collection(getFirebaseDb(), "tournaments", tournamentId, "teams"),
      (snap) => {
        setTeams(
          snap.docs.map((d) => ({
            ...(d.data() as TournamentTeam),
            id: d.id,
          }))
        );
      }
    );
    return () => unsub();
  }, [tournamentId, tournament?.status]);

  const maxPlayers = tournament?.maxPlayers ?? TOURNAMENT_MAX_PLAYERS;
  const memberUids = tournament?.memberUids ?? [];
  const serverSlots = useMemo(
    () => normalizeSlots(tournament?.slots, memberUids, maxPlayers),
    [tournament?.slots, memberUids, maxPlayers]
  );
  const displaySlots = optimisticSlots ?? serverSlots;

  const inRoom = useMemo(() => {
    if (!user?.uid) return false;
    return (
      memberUids.includes(user.uid) || displaySlots.includes(user.uid)
    );
  }, [user?.uid, memberUids, displaySlots]);

  const mySlotIndex = useMemo(() => {
    if (!user?.uid) return -1;
    const fromMember = members.find((m) => m.uid === user.uid)?.slotIndex;
    if (typeof fromMember === "number" && fromMember >= 0) return fromMember;
    return displaySlots.indexOf(user.uid);
  }, [user?.uid, members, displaySlots]);

  useEffect(() => {
    if (!user || !tournamentId || !inRoom) return;
    if (tournament?.status !== "registration") return;

    const tick = () => {
      void pruneTournament(tournamentId).catch(() => {});
    };
    tick();
    const interval = window.setInterval(tick, 30_000);
    return () => window.clearInterval(interval);
  }, [user, tournamentId, inRoom, tournament?.status]);

  const memberByUid = useMemo(() => {
    const map = new Map<string, TournamentMember & { id: string }>();
    for (const m of members) map.set(m.uid, m);
    return map;
  }, [members]);

  const playerCount =
    tournament?.playerCount ??
    displaySlots.filter(Boolean).length ??
    members.length;

  const isHost = user?.uid === tournament?.hostUid;
  const isLobby = tournament?.status === "registration";
  const needsPin =
    tournament?.visibility === "private" && !inRoom && isLobby;
  const pinOk = !needsPin || /^\d{4}$/.test(pin);
  const canAfford =
    (profile?.arenaCoins ?? 0) >=
    (tournament?.registrationFeeCoins ?? TOURNAMENT_ENTRY_FEE);

  const handleSlotClick = async (slotIndex: number) => {
    if (!user) {
      toast.error("Sign in to join.");
      return;
    }
    if (!tournament || !isLobby) return;

    const uid = displaySlots[slotIndex];
    if (uid === user.uid) return;
    if (uid) {
      toast.error("That slot is taken.");
      return;
    }
    if (!pinOk) {
      toast.error("Enter the 4-digit PIN first.");
      return;
    }
    if (!inRoom && !canAfford) {
      toast.error(
        `You need at least ${tournament.registrationFeeCoins ?? TOURNAMENT_ENTRY_FEE} coins.`
      );
      return;
    }

    const nextSlots = [...displaySlots];
    if (inRoom && mySlotIndex >= 0) {
      nextSlots[mySlotIndex] = null;
    }
    nextSlots[slotIndex] = user.uid;
    setOptimisticSlots(nextSlots);
    setJoiningSlot(slotIndex);

    try {
      const result = await joinTournamentRoom({
        tournamentId,
        pin: tournament.visibility === "private" ? pin : undefined,
        slotIndex,
      });
      if (!result.moved) {
        toast.success(`Joined slot ${slotIndex + 1}.`);
      }
    } catch (error) {
      setOptimisticSlots(null);
      toast.error(error instanceof Error ? error.message : "Join failed.");
    } finally {
      setJoiningSlot(null);
    }
  };

  const teamById = (teamId: string | null) =>
    teams.find((x) => x.id === teamId);

  const renderSlot = (index: number) => {
    const uid = displaySlots[index];
    const member = uid ? memberByUid.get(uid) : undefined;
    const isYou = uid === user?.uid;
    const isHostSlot = uid === tournament?.hostUid;
    const occupied = Boolean(uid);
    const joining = joiningSlot === index;
    const emptyClickable =
      !occupied &&
      isLobby &&
      Boolean(user) &&
      pinOk &&
      joiningSlot !== index &&
      (inRoom || canAfford);

    return (
      <button
        key={index}
        type="button"
        disabled={(!emptyClickable && !isYou) || joining}
        onClick={() => void handleSlotClick(index)}
        className={`rounded-lg border p-3 text-left transition min-h-[72px] w-full ${
          isYou
            ? "border-primary bg-primary/10 ring-1 ring-primary/40"
            : occupied
              ? "border-border/60 bg-muted/20 cursor-default"
              : emptyClickable
                ? "border-dashed border-muted-foreground/40 hover:border-primary/60 hover:bg-primary/5 cursor-pointer"
                : "border-dashed border-muted-foreground/25 opacity-60 cursor-default"
        }`}
      >
        <p className="text-[10px] uppercase text-muted-foreground">
          Slot {index + 1}
        </p>
        {joining ? (
          <Loader2 className="h-4 w-4 animate-spin mt-1 text-primary" />
        ) : occupied ? (
          <p className="text-sm font-medium truncate flex items-center gap-1 mt-0.5">
            {isHostSlot ? (
              <Crown className="h-3.5 w-3.5 text-amber-400 shrink-0" />
            ) : null}
            {member?.displayName ??
              (isHostSlot ? tournament?.hostDisplayName : null) ??
              "Player"}
            {isYou ? (
              <span className="text-muted-foreground font-normal">(you)</span>
            ) : null}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground mt-0.5">Empty</p>
        )}
      </button>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (notFound || !tournament) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 py-8 text-center">
        <p className="text-muted-foreground">Room not found or closed.</p>
        <Button variant="outline" onClick={() => router.push("/app/tournaments")}>
          Back to tournaments
        </Button>
      </div>
    );
  }

  if (tournament.status === "cancelled") {
    return (
      <div className="mx-auto max-w-2xl space-y-4 py-8 text-center">
        <p className="text-muted-foreground">This room was closed.</p>
        <Button variant="outline" onClick={() => router.push("/app/tournaments")}>
          Back to tournaments
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-8">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <Button
          variant="ghost"
          size="sm"
          className="mb-2 -ml-2 gap-1"
          onClick={() => router.push("/app/tournaments")}
        >
          <ArrowLeft className="h-4 w-4" />
          All rooms
        </Button>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-heading text-3xl neon-glow flex items-center gap-2 flex-wrap">
              <Trophy className="h-7 w-7" />
              {tournament.name}
              {tournament.visibility === "private" ? (
                <Badge variant="secondary" className="gap-1">
                  <Lock className="h-3 w-3" /> Private
                </Badge>
              ) : (
                <Badge variant="outline">Public</Badge>
              )}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isLobby ? "Lobby" : tournament.status} · Code{" "}
              <span className="font-mono text-foreground">
                {tournament.roomCode ?? "—"}
              </span>
              {tournament.hostDisplayName
                ? ` · Host ${tournament.hostDisplayName}`
                : null}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs text-muted-foreground uppercase flex items-center justify-end gap-1">
              <Users className="h-3.5 w-3.5" />
              {playerCount}/{maxPlayers}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1 uppercase">
              Champion reward
            </p>
            <p className="text-sm text-primary font-medium">
              {(tournament.championRewardCoins ?? 0).toLocaleString()} coins
            </p>
          </div>
        </div>
      </motion.div>

      {tournament.description ? (
        <p className="text-sm text-muted-foreground">{tournament.description}</p>
      ) : null}

      <p className="text-sm">
        Entry:{" "}
        <span className="text-primary font-medium">
          {tournament.registrationFeeCoins ?? TOURNAMENT_ENTRY_FEE} coins
        </span>{" "}
        per player (charged when the host starts). Teams = adjacent slots (1+2,
        3+4, …).
      </p>

      {isLobby ? (
        <Card className="arena-card border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Pick a slot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {needsPin ? (
              <Input
                inputMode="numeric"
                maxLength={4}
                placeholder="4-digit PIN"
                value={pin}
                onChange={(e) =>
                  setPin(e.target.value.replace(/\D/g, "").slice(0, 4))
                }
              />
            ) : null}

            <div className="space-y-3">
              {Array.from({ length: TEAM_COUNT }, (_, teamIdx) => {
                const slotA = teamIdx * 2;
                const slotB = teamIdx * 2 + 1;
                return (
                  <div
                    key={teamIdx}
                    className="rounded-lg border border-primary/15 bg-muted/5 p-3 space-y-2"
                  >
                    <p className="text-xs font-medium uppercase text-muted-foreground">
                      Team {teamIdx + 1}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {renderSlot(slotA)}
                      {renderSlot(slotB)}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col sm:flex-row gap-2 border-t border-primary/10 pt-4">
              {inRoom ? (
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() =>
                    void leaveTournament(tournamentId)
                      .then((r) => {
                        if (r.closed) {
                          toast.message("Room closed — no players left.");
                          router.push("/app/tournaments");
                        } else if (r.newHostUid) {
                          toast.message("Host passed to the next player.");
                        } else {
                          toast.success("Left the room.");
                        }
                      })
                      .catch((err) =>
                        toast.error(
                          err instanceof Error ? err.message : "Leave failed."
                        )
                      )
                  }
                >
                  Leave room
                </Button>
              ) : null}
              {isHost ? (
                <Button
                  className="flex-1 btn-arena-primary"
                  disabled={playerCount < maxPlayers}
                  onClick={() =>
                    void startTournamentBracket(tournamentId)
                      .then(() =>
                        toast.success("Tournament started — fees deducted.")
                      )
                      .catch((err) =>
                        toast.error(
                          err instanceof Error ? err.message : "Start failed."
                        )
                      )
                  }
                >
                  Start ({playerCount}/{maxPlayers})
                </Button>
              ) : null}
            </div>

            {!inRoom ? (
              <p className="text-xs text-muted-foreground">
                Click an empty slot to join. Requires{" "}
                {tournament.registrationFeeCoins ?? TOURNAMENT_ENTRY_FEE} coins
                in your wallet.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Click another empty slot to move seats.
              </p>
            )}

            {isHost && inRoom ? (
              <div className="space-y-1">
                <p className="text-xs uppercase text-muted-foreground">
                  Kick player
                </p>
                <ul className="space-y-1">
                  {members
                    .filter((m) => m.uid !== tournament.hostUid)
                    .map((m) => (
                      <li
                        key={m.uid}
                        className="flex items-center justify-between text-sm gap-2"
                      >
                        <span className="truncate">
                          {m.displayName}
                          {typeof m.slotIndex === "number"
                            ? ` · slot ${m.slotIndex + 1}`
                            : ""}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-destructive shrink-0"
                          onClick={() =>
                            void kickTournamentMember(tournamentId, m.uid)
                              .then(() => toast.success("Player kicked."))
                              .catch((err) =>
                                toast.error(
                                  err instanceof Error
                                    ? err.message
                                    : "Kick failed."
                                )
                              )
                          }
                        >
                          Kick
                        </Button>
                      </li>
                    ))}
                </ul>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {tournament.bracket && tournament.bracket.length > 0 ? (
        <Card className="arena-card border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              Bracket · Round {tournament.currentRound || 1}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {tournament.bracket.map((m) => {
              const a = teamById(m.team1Id);
              const b = teamById(m.team2Id);
              const waiting =
                Boolean(m.winnerTeamId) &&
                tournament.currentRound != null &&
                m.round === tournament.currentRound;
              return (
                <p key={m.id} className="text-xs text-muted-foreground">
                  R{m.round}M{m.matchIndex + 1}:{" "}
                  {a?.teamName ?? "TBD"} vs {b?.teamName ?? "TBD"}
                  {m.winnerTeamId
                    ? waiting
                      ? " — Won, waiting for bracket"
                      : " ✓"
                    : m.matchId
                      ? " (live)"
                      : ""}
                  {m.matchId ? (
                    <>
                      {" "}
                      <Link
                        href={`/app/match/${m.matchId}`}
                        className="text-primary underline"
                      >
                        open
                      </Link>
                    </>
                  ) : null}
                </p>
              );
            })}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
