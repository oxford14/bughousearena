"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { LogOut, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/providers/auth-provider";
import { useSound } from "@/providers/sound-provider";
import { subscribeToFriends } from "@/lib/social/friends";
import {
  friendActivityLabel,
  subscribeToFriendsPresence,
  type FriendPresence,
} from "@/lib/social/friend-presence";
import {
  acceptPartyInvite,
  canQueueParty,
  createParty,
  declinePartyInvite,
  inviteFriendToParty,
  isPartyLeader,
  leaveParty,
  setPartyMemberReady,
  subscribeToPartyInvites,
  subscribeToUserParty,
} from "@/lib/social/party";
import type { FriendEntry, PartyDocument, PartyInvite } from "@/types/firestore";
import { cn } from "@/lib/utils";

interface PartyPanelProps {
  searching?: boolean;
}

export function PartyPanel({ searching = false }: PartyPanelProps) {
  const { user, profile } = useAuth();
  const { play, unlock } = useSound();
  const [party, setParty] = useState<(PartyDocument & { id: string }) | null>(null);
  const [friends, setFriends] = useState<FriendEntry[]>([]);
  const [presenceByUid, setPresenceByUid] = useState<
    Record<string, FriendPresence>
  >({});
  const [invites, setInvites] = useState<PartyInvite[]>([]);
  const [busy, setBusy] = useState(false);
  const [invitingId, setInvitingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    return subscribeToUserParty(user.uid, setParty);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    return subscribeToFriends(user.uid, setFriends);
  }, [user]);

  const friendIds = useMemo(
    () => friends.map((f) => f.friendId),
    [friends]
  );

  useEffect(() => {
    return subscribeToFriendsPresence(friendIds, setPresenceByUid);
  }, [friendIds]);

  useEffect(() => {
    if (!user) return;
    return subscribeToPartyInvites(user.uid, setInvites);
  }, [user]);

  const handleCreate = async () => {
    if (!profile) return;
    setBusy(true);
    try {
      unlock();
      play("uiClick");
      await createParty(profile);
      toast.success("Party created — invite a friend below.");
    } catch (err) {
      const message =
        err instanceof Error && err.message.includes("permission")
          ? "Permission denied — refresh the page and try again."
          : "Could not create party.";
      toast.error(message);
      console.error("[party] create failed", err);
    } finally {
      setBusy(false);
    }
  };

  const handleLeave = async () => {
    if (!user || !party) return;
    setBusy(true);
    try {
      play("uiTab");
      await leaveParty(party.id, user.uid);
      toast.success("Left party.");
    } catch {
      toast.error("Could not leave party.");
    } finally {
      setBusy(false);
    }
  };

  const handleInvite = async (friend: FriendEntry) => {
    if (!profile || !party) return;
    setInvitingId(friend.friendId);
    try {
      play("uiClick");
      await inviteFriendToParty(profile, friend.friendId, party);
      toast.success(`Invited ${friend.displayName}`);
    } catch {
      toast.error("Could not send invite.");
    } finally {
      setInvitingId(null);
    }
  };

  const handleAcceptInvite = async (invite: PartyInvite) => {
    if (!profile) return;
    setBusy(true);
    try {
      play("uiSuccess");
      const joined = await acceptPartyInvite(profile, invite);
      if (!joined) {
        toast.error("Party is full or no longer available.");
        return;
      }
      toast.success("You joined the party!");
    } catch {
      toast.error("Could not join party.");
    } finally {
      setBusy(false);
    }
  };

  const handleToggleReady = async () => {
    if (!user || !party) return;
    const isReady = party.readyUids?.includes(user.uid) ?? false;
    setBusy(true);
    try {
      play("uiClick");
      await setPartyMemberReady(party.id, user.uid, !isReady);
    } catch {
      toast.error("Could not update ready status.");
    } finally {
      setBusy(false);
    }
  };

  const leader = party ? isPartyLeader(party, user?.uid ?? "") : true;
  const canQueue = canQueueParty(party, user?.uid ?? "");
  const openSlots = 2 - (party?.members.length ?? 0);
  const isReady = party?.readyUids?.includes(user?.uid ?? "") ?? false;
  const readyPartnerCount =
    party?.members.filter(
      (m) => m.uid !== user?.uid && party.readyUids?.includes(m.uid)
    ).length ?? 0;
  const inviteableFriends = friends.filter(
    (f) => !party?.memberUids.includes(f.friendId)
  );

  return (
    <Card className="arena-card lobby-party-card relative overflow-hidden border-primary/30">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" aria-hidden />
      <CardHeader className="relative z-10 pb-3">
        <CardTitle className="flex items-center gap-2 font-heading text-lg">
          <Users className="h-5 w-5 text-primary" />
          Party
          {party && (
            <Badge variant="secondary" className="ml-auto">
              {party.members.length}/2
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="relative z-10 space-y-4">
        <p className="text-sm text-muted-foreground">
          Team up with a partner before queuing. Parties stay on the same bughouse team when
          both players tap Ready. Solo players are auto-paired with others.
        </p>

        {invites.length > 0 && !party && (
          <div className="space-y-2 rounded-lg border border-primary/20 bg-muted/20 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-primary">
              Party invites
            </p>
            {invites.map((invite) => (
              <div
                key={invite.id}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <span>{invite.fromDisplayName}</span>
                <div className="flex gap-1">
                  <Button
                    size="xs"
                    className="cursor-pointer"
                    disabled={busy}
                    onClick={() => void handleAcceptInvite(invite)}
                  >
                    Join
                  </Button>
                  <Button
                    size="xs"
                    variant="outline"
                    className="cursor-pointer"
                    disabled={busy}
                    onClick={() => void declinePartyInvite(user!.uid, invite.id)}
                  >
                    Decline
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {party ? (
          <>
            <div className="flex flex-wrap gap-3">
              {party.members.map((member) => (
                <div
                  key={member.uid}
                  className="flex items-center gap-2 rounded-lg border border-primary/15 bg-muted/10 px-3 py-2"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={member.photoURL ?? undefined} />
                    <AvatarFallback>{member.displayName[0]}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium leading-none">{member.displayName}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {member.uid === party.leaderUid ? "Leader" : "Partner"} · {member.rating}
                      {party.readyUids?.includes(member.uid) ? " · Ready" : ""}
                    </p>
                  </div>
                </div>
              ))}
              {openSlots > 0 &&
                Array.from({ length: openSlots }).map((_, i) => (
                  <div
                    key={`empty-${i}`}
                    className="flex h-[52px] min-w-[140px] items-center justify-center rounded-lg border border-dashed border-primary/25 text-xs text-muted-foreground"
                  >
                    Open slot
                  </div>
                ))}
            </div>

            {openSlots > 0 && leader && !searching && (
              <div className="space-y-2 rounded-lg border border-primary/20 bg-[#0a0618]/50 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-secondary flex items-center gap-1.5">
                  <UserPlus className="h-3.5 w-3.5" />
                  Invite a friend
                </p>
                {friends.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Add friends on the{" "}
                    <Link href="/app/friends" className="text-primary hover:underline">
                      Friends
                    </Link>{" "}
                    page to invite them here.
                  </p>
                ) : inviteableFriends.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    All your friends are already in this party or invited.
                  </p>
                ) : (
                  <ul className="space-y-1.5 max-h-[200px] overflow-y-auto">
                    {inviteableFriends.map((friend) => (
                      <li
                        key={friend.friendId}
                        className="flex items-center justify-between gap-2 rounded-md px-1 py-0.5"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Avatar className="h-7 w-7 shrink-0">
                            <AvatarImage src={friend.photoURL ?? undefined} />
                            <AvatarFallback className="text-xs">
                              {friend.displayName[0]}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm truncate">{friend.displayName}</span>
                          <span
                            className={cn(
                              "h-2 w-2 shrink-0 rounded-full",
                              (() => {
                                const activity =
                                  presenceByUid[friend.friendId]?.activity ??
                                  "offline";
                                if (activity === "in_match") return "bg-rose-400";
                                if (activity === "in_queue") return "bg-sky-400";
                                if (activity === "online") return "bg-emerald-400";
                                if (activity === "away") return "bg-amber-400";
                                return "bg-muted-foreground/40";
                              })()
                            )}
                            title={friendActivityLabel(
                              presenceByUid[friend.friendId]?.activity ??
                                "offline"
                            )}
                          />
                        </div>
                        <Button
                          size="xs"
                          variant="outline"
                          className="cursor-pointer shrink-0"
                          disabled={busy || invitingId === friend.friendId}
                          onClick={() => void handleInvite(friend)}
                        >
                          Invite
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              {party.members.length > 1 && !searching && (
                <Button
                  size="sm"
                  variant={isReady ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => void handleToggleReady()}
                  disabled={busy}
                >
                  {isReady ? "Ready" : "Ready to play"}
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="cursor-pointer ml-auto"
                onClick={() => void handleLeave()}
                disabled={busy || searching}
              >
                <LogOut className="h-3.5 w-3.5 mr-1" /> Leave
              </Button>
            </div>

            {!leader && (
              <p className="text-xs text-muted-foreground">
                Tap Ready to play when you want to join your leader&apos;s next match. You won&apos;t
                be queued until you do.
              </p>
            )}
            {leader && party.members.length > 1 && readyPartnerCount === 0 && (
              <p className="text-xs text-muted-foreground">
                Your partner hasn&apos;t readied up — you&apos;ll queue solo until they tap Ready.
              </p>
            )}
            {leader && party.members.length > 1 && readyPartnerCount > 0 && (
              <p className="text-xs text-muted-foreground">
                Partner is ready — you&apos;ll queue together on the same team.
              </p>
            )}
            {party.members.length === 1 && leader && (
              <p className="text-xs text-muted-foreground">
                Invite a friend above, or queue solo — we&apos;ll pair you with another player.
              </p>
            )}
          </>
        ) : (
          <Button
            className="w-full btn-arena-primary cursor-pointer"
            onClick={() => void handleCreate()}
            disabled={busy || searching}
          >
            Create Party
          </Button>
        )}

        {party && !canQueue && searching && (
          <p className="text-xs text-primary">
            Your leader is searching for a match
            {isReady ? " — you're queued together." : "."}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
