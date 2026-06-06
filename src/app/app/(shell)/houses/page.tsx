"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { LogOut, Settings, UserMinus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/providers/auth-provider";
import {
  createHouse,
  getHouse,
  isHouseFounder,
  joinHouse,
  kickMember,
  leaveHouse,
  searchHouses,
  sendHouseMessage,
  subscribeToHouseChat,
  subscribeToHouseMembers,
  subscribeToHouses,
  updateHouseSettings,
} from "@/lib/social/houses";
import type { HouseChatMessage, HouseDocument, HouseMember } from "@/types/firestore";
import { toast } from "sonner";

function BrowseHousesList({
  houses,
  myHouseId,
  onJoin,
}: {
  houses: HouseDocument[];
  myHouseId: string | null | undefined;
  onJoin: (houseId: string) => void;
}) {
  return (
    <div className="space-y-2">
      {houses.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">No houses found.</p>
      ) : (
        houses.map((house) => {
          const isMine = myHouseId === house.id;
          const canJoin = !myHouseId && house.autoAccept === true;

          return (
            <div
              key={house.id}
              className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/20 border border-primary/10"
            >
              <div className="min-w-0">
                <p className="font-medium truncate">{house.name}</p>
                <p className="text-xs text-muted-foreground">
                  {house.memberCount} members · Rating {house.houseRating}
                  {house.autoAccept ? " · Open" : " · Invite only"}
                </p>
              </div>
              {isMine ? (
                <Badge variant="secondary" className="shrink-0">
                  Your house
                </Badge>
              ) : myHouseId ? (
                <span className="text-xs text-muted-foreground shrink-0 text-right max-w-[120px]">
                  Leave your house to join
                </span>
              ) : canJoin ? (
                <Button size="sm" onClick={() => onJoin(house.id)} className="cursor-pointer shrink-0">
                  Join
                </Button>
              ) : (
                <span className="text-xs text-muted-foreground shrink-0">Invite only</span>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

function FounderSettings({
  house,
  onSaved,
}: {
  house: HouseDocument;
  onSaved: () => void;
}) {
  const [name, setName] = useState(house.name);
  const [description, setDescription] = useState(house.description);
  const [autoAccept, setAutoAccept] = useState(house.autoAccept ?? false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(house.name);
    setDescription(house.description);
    setAutoAccept(house.autoAccept ?? false);
  }, [house]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateHouseSettings(house.id, { name, description, autoAccept });
      onSaved();
      toast.success("House settings saved.");
    } catch {
      toast.error("Could not save settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="arena-card border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="font-heading text-base flex items-center gap-2">
          <Settings className="h-4 w-4 text-primary" />
          Manage house
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="house-name">House name</Label>
          <Input
            id="house-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={48}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="house-desc">Description</Label>
          <Input
            id="house-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={200}
          />
        </div>
        <div className="flex items-center justify-between gap-4 rounded-lg border border-primary/15 bg-muted/10 px-3 py-3">
          <div>
            <p className="text-sm font-medium">Auto-accept members</p>
            <p className="text-xs text-muted-foreground">
              When enabled, players can join without your approval.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant={autoAccept ? "default" : "outline"}
            className="cursor-pointer shrink-0"
            onClick={() => setAutoAccept((v) => !v)}
          >
            {autoAccept ? "On" : "Off"}
          </Button>
        </div>
        <Button
          onClick={() => void handleSave()}
          disabled={saving || !name.trim()}
          className="btn-arena-primary cursor-pointer"
        >
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </CardContent>
    </Card>
  );
}

function MyHousePanel({
  house,
  members,
  chat,
  chatText,
  onChatTextChange,
  onSendChat,
  myUid,
  isFounder,
  onLeave,
  onKick,
  onHouseUpdated,
}: {
  house: HouseDocument;
  members: HouseMember[];
  chat: HouseChatMessage[];
  chatText: string;
  onChatTextChange: (v: string) => void;
  onSendChat: () => void;
  myUid: string;
  isFounder: boolean;
  onLeave: () => void;
  onKick: (uid: string) => void;
  onHouseUpdated: () => void;
}) {
  const myMembership = members.find((m) => m.uid === myUid);

  return (
    <div className="space-y-4">
      <Card className="arena-card border-primary/20 overflow-hidden">
        <div className="relative h-32">
          <Image src={house.bannerUrl} alt="" fill className="object-cover opacity-60" />
        </div>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <CardTitle className="font-heading flex items-center gap-3">
              <Image src={house.crestUrl} alt="" width={32} height={32} />
              {house.name}
            </CardTitle>
            {!isFounder && (
              <Button
                variant="outline"
                size="sm"
                className="cursor-pointer text-destructive border-destructive/40 hover:bg-destructive/10"
                onClick={onLeave}
              >
                <LogOut className="h-4 w-4 mr-1.5" />
                Leave house
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{house.description}</p>
          <div className="flex flex-wrap gap-2">
            <Badge variant={house.autoAccept ? "default" : "outline"}>
              {house.autoAccept ? "Open to join" : "Invite only"}
            </Badge>
            {myMembership && (
              <Badge variant="secondary" className="capitalize">
                {myMembership.role}
              </Badge>
            )}
          </div>

          <div>
            <h3 className="font-heading text-sm mb-2">Members ({members.length})</h3>
            <div className="space-y-2">
              {members.map((m) => (
                <div
                  key={m.uid}
                  className="flex items-center justify-between gap-2 rounded-lg border border-primary/10 bg-muted/10 px-3 py-2"
                >
                  <span className="text-sm">
                    {m.displayName}
                    <span className="text-muted-foreground"> · {m.role}</span>
                    {m.uid === myUid ? (
                      <span className="text-muted-foreground"> (you)</span>
                    ) : null}
                  </span>
                  {isFounder && m.role !== "founder" && m.uid !== myUid ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="cursor-pointer text-destructive hover:text-destructive hover:bg-destructive/10 h-8 px-2"
                      onClick={() => onKick(m.uid)}
                    >
                      <UserMinus className="h-4 w-4 mr-1" />
                      Kick
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="font-heading text-sm mb-2">House Hall</h3>
            <div className="h-40 overflow-y-auto space-y-1 mb-2 bg-muted/20 rounded-lg p-3">
              {chat.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">
                  No messages yet. Say hello to the hall.
                </p>
              ) : (
                chat.map((msg) => (
                  <p key={msg.id} className="text-sm">
                    <span className="text-primary">{msg.displayName}:</span> {msg.text}
                  </p>
                ))
              )}
            </div>
            <div className="flex gap-2">
              <Input
                value={chatText}
                onChange={(e) => onChatTextChange(e.target.value)}
                placeholder="Message the hall..."
                onKeyDown={(e) => {
                  if (e.key === "Enter") onSendChat();
                }}
              />
              <Button onClick={onSendChat} className="cursor-pointer shrink-0">
                Send
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {isFounder && <FounderSettings house={house} onSaved={onHouseUpdated} />}
    </div>
  );
}

export default function HousesPage() {
  const { profile, refreshProfile } = useAuth();
  const [houses, setHouses] = useState<HouseDocument[]>([]);
  const [members, setMembers] = useState<HouseMember[]>([]);
  const [chat, setChat] = useState<HouseChatMessage[]>([]);
  const [houseName, setHouseName] = useState("");
  const [houseDesc, setHouseDesc] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [chatText, setChatText] = useState("");
  const [myHouse, setMyHouse] = useState<HouseDocument | null>(null);
  const [activeTab, setActiveTab] = useState("my-house");

  useEffect(() => {
    return subscribeToHouses(setHouses);
  }, []);

  useEffect(() => {
    if (!profile?.houseId) {
      setMyHouse(null);
      setMembers([]);
      setChat([]);
      return;
    }
    void getHouse(profile.houseId).then(setMyHouse);
    const unsubMembers = subscribeToHouseMembers(profile.houseId, setMembers);
    const unsubChat = subscribeToHouseChat(profile.houseId, setChat);
    return () => {
      unsubMembers();
      unsubChat();
    };
  }, [profile?.houseId]);

  const myMembership = useMemo(
    () => members.find((m) => m.uid === profile?.uid),
    [members, profile?.uid]
  );

  const isFounder = useMemo(
    () => (myHouse && myMembership ? isHouseFounder(myMembership, myHouse) : false),
    [myHouse, myMembership]
  );

  const handleCreate = async () => {
    if (!profile || !houseName.trim()) return;
    if (profile.houseId) {
      toast.error("Leave your current house before founding a new one.");
      return;
    }
    try {
      await createHouse(profile, houseName.trim(), houseDesc.trim());
      await refreshProfile();
      toast.success("House created!");
      setHouseName("");
      setHouseDesc("");
    } catch {
      toast.error("Failed to create house.");
    }
  };

  const handleJoin = async (houseId: string) => {
    if (!profile) return;
    if (profile.houseId) {
      toast.error("Leave your current house before joining another.");
      return;
    }
    try {
      await joinHouse(houseId, profile);
      await refreshProfile();
      toast.success("Joined house!");
      setActiveTab("my-house");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to join house.");
    }
  };

  const handleLeave = async () => {
    if (!profile?.houseId || !profile) return;
    try {
      await leaveHouse(profile.houseId, profile);
      await refreshProfile();
      toast.success("Left house.");
      setActiveTab("browse");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not leave house.");
    }
  };

  const handleKick = async (targetUid: string) => {
    if (!profile?.houseId || !profile) return;
    try {
      await kickMember(profile.houseId, profile.uid, targetUid);
      toast.success("Member removed.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove member.");
    }
  };

  const handleSearch = async () => {
    const results = await searchHouses(searchQuery);
    setHouses(results);
  };

  const handleSendChat = async () => {
    if (!profile?.houseId || !chatText.trim()) return;
    await sendHouseMessage(
      profile.houseId,
      profile.uid,
      profile.displayName,
      chatText.trim()
    );
    setChatText("");
  };

  const refreshMyHouse = async () => {
    if (!profile?.houseId) return;
    const updated = await getHouse(profile.houseId);
    setMyHouse(updated);
  };

  const browseSection = (
    <Card className="arena-card border-primary/20">
      <CardHeader>
        <CardTitle className="font-heading">All Houses</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Search houses..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleSearch();
            }}
          />
          <Button onClick={() => void handleSearch()} className="cursor-pointer shrink-0">
            Search
          </Button>
        </div>
        <BrowseHousesList
          houses={houses}
          myHouseId={profile?.houseId}
          onJoin={(id) => void handleJoin(id)}
        />
      </CardContent>
    </Card>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="font-heading text-3xl neon-glow">Houses</h1>

      {!profile?.houseId && (
        <>
          <Card className="arena-card border-primary/20">
            <CardHeader>
              <CardTitle className="font-heading">Create a House</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                placeholder="House name"
                value={houseName}
                onChange={(e) => setHouseName(e.target.value)}
              />
              <Input
                placeholder="Description"
                value={houseDesc}
                onChange={(e) => setHouseDesc(e.target.value)}
              />
              <Button onClick={() => void handleCreate()} className="btn-arena-primary cursor-pointer">
                Found House
              </Button>
            </CardContent>
          </Card>
          {browseSection}
        </>
      )}

      {profile?.houseId && myHouse && profile && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="arena-card border border-primary/20 bg-muted/30">
            <TabsTrigger value="my-house" className="cursor-pointer">
              My House
            </TabsTrigger>
            <TabsTrigger value="browse" className="cursor-pointer">
              All Houses
            </TabsTrigger>
          </TabsList>

          <TabsContent value="my-house" className="mt-4">
            <MyHousePanel
              house={myHouse}
              members={members}
              chat={chat}
              chatText={chatText}
              onChatTextChange={setChatText}
              onSendChat={() => void handleSendChat()}
              myUid={profile.uid}
              isFounder={isFounder}
              onLeave={() => void handleLeave()}
              onKick={(uid) => void handleKick(uid)}
              onHouseUpdated={() => void refreshMyHouse()}
            />
          </TabsContent>

          <TabsContent value="browse" className="mt-4">
            {browseSection}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
