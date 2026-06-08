"use client";

import { useEffect, useState } from "react";
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
import type { DirectMessage, FriendEntry, FriendRequest } from "@/types/firestore";
import { toast } from "sonner";

export default function FriendsPage() {
  const { profile } = useAuth();
  const [friends, setFriends] = useState<FriendEntry[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
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

  const friendIds = new Set(friends.map((f) => f.friendId));

  const handleSearch = async () => {
    if (!profile) return;
    const query = searchQuery.trim();
    if (query.length < 2) {
      toast.error("Enter at least 2 characters to search.");
      return;
    }

    setSearching(true);
    setHasSearched(true);
    try {
      const results = await searchUsersByDisplayName(query, {
        excludeUid: profile.uid,
        limit: 8,
      });
      setSearchResults(results);
      if (results.length === 0) {
        toast.message("No players found.", {
          description: "Try a different spelling or the start of their display name.",
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
    if (friendIds.has(user.uid)) {
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
    await sendDirectMessage(profile.uid, selectedFriend, profile.uid, messageText);
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
              No players match &ldquo;{searchQuery.trim()}&rdquo;. Try the beginning of their
              display name.
            </p>
          )}

          {searchResults.length > 0 && (
            <ul className="space-y-2">
              {searchResults.map((user) => {
                const isFriend = friendIds.has(user.uid);
                const requestSent = sentRequestUids.has(user.uid);

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
                    <Badge
                      variant={user.onlineStatus === "online" ? "default" : "secondary"}
                      className="hidden sm:inline-flex"
                    >
                      {user.onlineStatus}
                    </Badge>
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
                  <Button size="sm" onClick={() => handleAccept(req)} className="cursor-pointer">Accept</Button>
                  <Button size="sm" variant="outline" onClick={() => declineFriendRequest(profile!.uid, req.id)} className="cursor-pointer">Decline</Button>
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
            {friends.length === 0 && (
              <p className="text-sm text-muted-foreground">No friends yet.</p>
            )}
            {friends.map((friend) => (
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
                <span className="flex-1 text-left">{friend.displayName}</span>
                <Badge variant={friend.onlineStatus === "online" ? "default" : "secondary"}>
                  {friend.onlineStatus}
                </Badge>
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
                .filter((m) => !selectedFriend || m.fromUid === selectedFriend || m.fromUid === profile?.uid)
                .map((m) => (
                  <p key={m.id} className="text-sm">
                    <span className="text-primary">{m.fromUid === profile?.uid ? "You" : "Friend"}:</span> {m.text}
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
              <Button onClick={handleSendMessage} disabled={!selectedFriend} className="cursor-pointer">Send</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
