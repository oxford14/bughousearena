"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/providers/auth-provider";
import {
  acceptFriendRequest,
  declineFriendRequest,
  findUserByDisplayName,
  sendDirectMessage,
  sendFriendRequest,
  subscribeToFriendRequests,
  subscribeToFriends,
  subscribeToMessages,
} from "@/lib/social/friends";
import type { DirectMessage, FriendEntry, FriendRequest } from "@/types/firestore";
import { toast } from "sonner";

export default function FriendsPage() {
  const { profile } = useAuth();
  const [friends, setFriends] = useState<FriendEntry[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [searchName, setSearchName] = useState("");
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

  const handleAddFriend = async () => {
    if (!profile || !searchName) return;
    const user = await findUserByDisplayName(searchName);
    if (!user) {
      toast.error("Player not found.");
      return;
    }
    await sendFriendRequest(profile, user.uid);
    toast.success("Friend request sent!");
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
          <CardTitle className="font-heading">Add Friend</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Input
            placeholder="Display name"
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
          />
          <Button onClick={handleAddFriend} className="cursor-pointer">Send Request</Button>
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
