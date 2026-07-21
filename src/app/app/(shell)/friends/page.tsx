"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/providers/auth-provider";
import {
  acceptFriendRequest,
  declineFriendRequest,
  searchUsersByDisplayName,
  sendDirectMessage,
  sendFriendRequest,
  subscribeToFriendRequests,
  subscribeToFriends,
  subscribeToMessages,
  type UserSearchResult,
} from "@/lib/social/friends";
import {
  friendActivityLabel,
  subscribeToFriendsPresence,
  type FriendActivityStatus,
  type FriendPresence,
} from "@/lib/social/friend-presence";
import type { DirectMessage, FriendEntry, FriendRequest } from "@/types/firestore";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function activityBadgeClass(status: FriendActivityStatus): string {
  switch (status) {
    case "in_match":
      return "bg-rose-500/20 text-rose-300 hover:bg-rose-500/20 border-rose-500/30";
    case "in_queue":
      return "bg-sky-500/20 text-sky-300 hover:bg-sky-500/20 border-sky-500/30";
    case "online":
      return "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/20 border-emerald-500/30";
    case "away":
      return "bg-amber-500/20 text-amber-300 hover:bg-amber-500/20 border-amber-500/30";
    default:
      return "";
  }
}

function FriendStatusBadge({
  presence,
  className,
}: {
  presence: FriendPresence | undefined;
  className?: string;
}) {
  const activity = presence?.activity ?? "offline";
  const isOffline = activity === "offline";
  return (
    <Badge
      variant={isOffline ? "secondary" : "outline"}
      className={cn(
        "capitalize shrink-0",
        !isOffline && activityBadgeClass(activity),
        className
      )}
    >
      {friendActivityLabel(activity)}
    </Badge>
  );
}

export default function FriendsPage() {
  const { profile } = useAuth();
  const [friends, setFriends] = useState<FriendEntry[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [presenceByUid, setPresenceByUid] = useState<
    Record<string, FriendPresence>
  >({});
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [sentRequestUids, setSentRequestUids] = useState<Set<string>>(new Set());
  const [sendingToUid, setSendingToUid] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const [selectedFriend, setSelectedFriend] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    const unsubFriends = subscribeToFriends(profile.uid, setFriends);
    const unsubRequests = subscribeToFriendRequests(profile.uid, setRequests);
    const unsubMessages = subscribeToMessages(profile.uid, setMessages);
    return () => {
      unsubFriends();
      unsubRequests();
      unsubMessages();
    };
  }, [profile]);

  const friendIds = useMemo(
    () => friends.map((f) => f.friendId),
    [friends]
  );

  useEffect(() => {
    return subscribeToFriendsPresence(friendIds, setPresenceByUid);
  }, [friendIds]);

  const friendIdSet = useMemo(() => new Set(friendIds), [friendIds]);

  const sortedFriends = useMemo(() => {
    const rank = (uid: string) => {
      const a = presenceByUid[uid]?.activity ?? "offline";
      if (a === "in_match") return 0;
      if (a === "in_queue") return 1;
      if (a === "online") return 2;
      if (a === "away") return 3;
      return 4;
    };
    return [...friends].sort((a, b) => {
      const d = rank(a.friendId) - rank(b.friendId);
      if (d !== 0) return d;
      return a.displayName.localeCompare(b.displayName);
    });
  }, [friends, presenceByUid]);

  const handleSearch = async () => {
    if (!profile) return;
    const queryText = searchQuery.trim();
    if (queryText.length < 2) {
      toast.error("Enter at least 2 characters to search.");
      return;
    }

    setSearching(true);
    setHasSearched(true);
    try {
      const results = await searchUsersByDisplayName(queryText, {
        excludeUid: profile.uid,
        limit: 8,
      });
      setSearchResults(results);
      if (results.length === 0) {
        toast.message("No players found.", {
          description:
            "Try a different spelling or the start of their display name.",
        });
      }
    } catch {
      toast.error("Search failed. Please try again.");
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleSendRequest = async (user: UserSearchResult) => {
    if (!profile) return;
    if (friendIdSet.has(user.uid)) {
      toast.message("Already friends.");
      return;
    }

    setSendingToUid(user.uid);
    try {
      await sendFriendRequest(profile, user.uid);
      setSentRequestUids((prev) => new Set(prev).add(user.uid));
      toast.success(`Friend request sent to ${user.displayName}!`);
    } catch {
      toast.error("Could not send request. Please try again.");
    } finally {
      setSendingToUid(null);
    }
  };

  const handleAccept = async (req: FriendRequest) => {
    if (!profile) return;
    await acceptFriendRequest(profile.uid, req, profile);
    toast.success("Friend added!");
  };

  const handleSendMessage = async () => {
    if (!profile || !selectedFriend || !messageText) return;
    await sendDirectMessage(
      profile.uid,
      selectedFriend,
      profile.uid,
      messageText
    );
    setMessageText("");
    toast.success("Message sent!");
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="font-heading text-3xl neon-glow">Friends</h1>

      <Card className="arena-card border-primary/20">
        <CardHeader>
          <CardTitle className="font-heading">Find Player</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Search display name…"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setHasSearched(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleSearch();
              }}
            />
            <Button
              onClick={() => void handleSearch()}
              disabled={searching || searchQuery.trim().length < 2}
              className="cursor-pointer shrink-0"
            >
              {searching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Search className="h-4 w-4 mr-1.5" />
                  Search
                </>
              )}
            </Button>
          </div>

          {hasSearched && !searching && searchResults.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No players match &ldquo;{searchQuery.trim()}&rdquo;. Try the beginning
              of their display name.
            </p>
          )}

          {searchResults.length > 0 && (
            <ul className="space-y-2">
              {searchResults.map((user) => {
                const isFriend = friendIdSet.has(user.uid);
                const requestSent = sentRequestUids.has(user.uid);
                const presence = presenceByUid[user.uid];

                return (
                  <li
                    key={user.uid}
                    className="flex items-center gap-3 p-2 rounded-lg border border-border/60 bg-muted/20"
                  >
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={user.photoURL ?? undefined} />
                      <AvatarFallback>{user.displayName[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{user.displayName}</p>
                      <p className="text-xs text-muted-foreground">
                        Rating {user.rating}
                      </p>
                    </div>
                    <FriendStatusBadge
                      presence={
                        presence ?? {
                          uid: user.uid,
                          onlineStatus: user.onlineStatus,
                          inMatch: false,
                          inQueue: false,
                          matchId: null,
                          activity: user.onlineStatus,
                        }
                      }
                      className="hidden sm:inline-flex"
                    />
                    {isFriend ? (
                      <Badge variant="outline">Friends</Badge>
                    ) : requestSent ? (
                      <Badge variant="secondary">Request sent</Badge>
                    ) : (
                      <Button
                        size="sm"
                        disabled={sendingToUid === user.uid}
                        onClick={() => void handleSendRequest(user)}
                        className="cursor-pointer shrink-0"
                      >
                        {sendingToUid === user.uid ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Add"
                        )}
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {requests.length > 0 && (
        <Card className="arena-card border-primary/20">
          <CardHeader>
            <CardTitle className="font-heading">Pending Requests</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {requests.map((req) => (
              <div key={req.id} className="flex items-center justify-between">
                <span>{req.fromDisplayName}</span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleAccept(req)}
                    className="cursor-pointer"
                  >
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      declineFriendRequest(profile!.uid, req.id)
                    }
                    className="cursor-pointer"
                  >
                    Decline
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="arena-card border-primary/20">
          <CardHeader>
            <CardTitle className="font-heading">Friend List</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {sortedFriends.length === 0 && (
              <p className="text-sm text-muted-foreground">No friends yet.</p>
            )}
            {sortedFriends.map((friend) => (
              <button
                key={friend.friendId}
                type="button"
                onClick={() => setSelectedFriend(friend.friendId)}
                className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={friend.photoURL ?? undefined} />
                  <AvatarFallback>{friend.displayName[0]}</AvatarFallback>
                </Avatar>
                <span className="flex-1 text-left truncate">
                  {friend.displayName}
                </span>
                <FriendStatusBadge presence={presenceByUid[friend.friendId]} />
              </button>
            ))}
          </CardContent>
        </Card>

        <Card className="arena-card border-primary/20">
          <CardHeader>
            <CardTitle className="font-heading">Messages</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="h-48 overflow-y-auto space-y-2">
              {messages
                .filter(
                  (m) =>
                    !selectedFriend ||
                    m.fromUid === selectedFriend ||
                    m.fromUid === profile?.uid
                )
                .map((m) => (
                  <p key={m.id} className="text-sm">
                    <span className="text-primary">
                      {m.fromUid === profile?.uid ? "You" : "Friend"}:
                    </span>{" "}
                    {m.text}
                  </p>
                ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Type a message..."
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                disabled={!selectedFriend}
              />
              <Button
                onClick={handleSendMessage}
                disabled={!selectedFriend}
                className="cursor-pointer"
              >
                Send
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
