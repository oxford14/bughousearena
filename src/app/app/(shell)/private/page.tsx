"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/providers/auth-provider";
import {
  createPrivateRoom,
  joinPrivateRoom,
  subscribeToPrivateRoom,
} from "@/lib/game/matchmaking";
import type { PrivateRoom } from "@/types/firestore";
import { toast } from "sonner";
import {
  getGameTypeMeta,
  normalizeGameType,
  parseGameTypeParam,
  playersNeeded,
  type ChessGameType,
} from "@/lib/game/game-types";

export default function PrivateRoomPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [code, setCode] = useState("");
  const [room, setRoom] = useState<PrivateRoom | null>(null);
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [gameType, setGameType] = useState<ChessGameType>(() =>
    normalizeGameType(parseGameTypeParam(searchParams.get("gameType")))
  );

  useEffect(() => {
    const fromUrl = parseGameTypeParam(searchParams.get("gameType"));
    if (fromUrl) setGameType(fromUrl);
  }, [searchParams]);

  useEffect(() => {
    if (!createdCode) return;
    return subscribeToPrivateRoom(createdCode, setRoom);
  }, [createdCode]);

  useEffect(() => {
    if (room?.status === "started" && room.matchId) {
      router.push(`/app/match/${room.matchId}`);
    }
  }, [room, router]);

  const handleCreate = async () => {
    if (!profile) return;
    try {
      const newCode = await createPrivateRoom(profile, "private", gameType);
      setCreatedCode(newCode);
      toast.success(`Room created: ${newCode}`);
    } catch {
      toast.error("Failed to create room.");
    }
  };

  const handleJoin = async () => {
    if (!profile || !code) return;
    try {
      const joined = await joinPrivateRoom(code, profile);
      if (!joined) {
        toast.error("Room not found.");
        return;
      }
      setRoom(joined);
      setCreatedCode(code.toUpperCase());
      toast.success("Joined room!");
    } catch {
      toast.error("Failed to join room.");
    }
  };

  const activeType = room
    ? normalizeGameType(room.settings.gameType)
    : gameType;
  const meta = getGameTypeMeta(activeType);
  const need = playersNeeded(activeType);

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h1 className="font-heading text-3xl neon-glow">Private Rooms</h1>
      <p className="text-sm text-muted-foreground">
        {meta.shortLabel} · needs {need} players
      </p>

      <Card className="arena-card border-primary/20">
        <CardHeader>
          <CardTitle className="font-heading">Create Room</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <select
            value={gameType}
            onChange={(e) => setGameType(e.target.value as ChessGameType)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm cursor-pointer"
          >
            <option value="bughouse">Bughouse (4 players)</option>
            <option value="standard">Standard Chess (2 players)</option>
            <option value="crazyhouse">Crazyhouse (2 players)</option>
            <option value="atomic">Atomic Chess (2 players)</option>
          </select>
          <Button
            onClick={handleCreate}
            className="btn-arena-primary cursor-pointer w-full"
          >
            Create New Room
          </Button>
        </CardContent>
      </Card>

      <Card className="arena-card border-primary/20">
        <CardHeader>
          <CardTitle className="font-heading">Join Room</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Input
            placeholder="Room code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={6}
          />
          <Button onClick={handleJoin} className="cursor-pointer">
            Join
          </Button>
        </CardContent>
      </Card>

      {room ? (
        <Card className="arena-card border-primary/20">
          <CardHeader>
            <CardTitle className="font-heading">Room {room.code}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {room.players.length}/{need} players · Host: {room.hostDisplayName}
            </p>
            <ul className="space-y-1">
              {room.players.map((p) => (
                <li key={p.uid} className="text-sm">
                  {p.displayName}
                </li>
              ))}
            </ul>
            {room.status === "started" && room.matchId ? (
              <Button
                className="btn-arena-primary cursor-pointer w-full"
                onClick={() => router.push(`/app/match/${room.matchId}`)}
              >
                Enter Match
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
