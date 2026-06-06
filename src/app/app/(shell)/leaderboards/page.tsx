"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  getFriendsLeaderboard,
  subscribeToGlobalLeaderboard,
  subscribeToHouseLeaderboard,
  subscribeToSeasonalLeaderboard,
} from "@/lib/social/leaderboards";
import { subscribeToFriends } from "@/lib/social/friends";
import { useAuth } from "@/providers/auth-provider";
import { getRankAssetPath, getRankTier } from "@/lib/game/elo";
import type { LeaderboardEntry } from "@/types/firestore";

function LeaderboardTable({ entries }: { entries: LeaderboardEntry[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Rank</TableHead>
          <TableHead>Player</TableHead>
          <TableHead>Rating</TableHead>
          <TableHead className="text-right">Wins</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.length === 0 && (
          <TableRow>
            <TableCell colSpan={4} className="text-center text-muted-foreground">
              No entries yet. Connect Firebase to populate leaderboards.
            </TableCell>
          </TableRow>
        )}
        {entries.map((entry) => {
          const tier = getRankTier(entry.rating);
          return (
            <TableRow key={entry.id}>
              <TableCell className="font-heading text-primary">#{entry.rank}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={entry.photoURL ?? undefined} />
                    <AvatarFallback>{entry.displayName[0]}</AvatarFallback>
                  </Avatar>
                  <Image src={getRankAssetPath(tier)} alt="" width={16} height={16} />
                  {entry.displayName}
                </div>
              </TableCell>
              <TableCell>{entry.rating}</TableCell>
              <TableCell className="text-right">{entry.wins}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

export default function LeaderboardsPage() {
  const { profile } = useAuth();
  const [global, setGlobal] = useState<LeaderboardEntry[]>([]);
  const [houses, setHouses] = useState<LeaderboardEntry[]>([]);
  const [seasonal, setSeasonal] = useState<LeaderboardEntry[]>([]);
  const [friends, setFriendsLb] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    const unsubs = [
      subscribeToGlobalLeaderboard(setGlobal),
      subscribeToHouseLeaderboard(setHouses),
      subscribeToSeasonalLeaderboard("current", setSeasonal),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  useEffect(() => {
    if (!profile) return;
    return subscribeToFriends(profile.uid, async (friendList) => {
      const ids = friendList.map((f) => f.friendId);
      const lb = await getFriendsLeaderboard(ids);
      setFriendsLb(lb);
    });
  }, [profile]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="font-heading text-3xl neon-glow">Leaderboards</h1>

      <Tabs defaultValue="global">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="global" className="cursor-pointer">Global</TabsTrigger>
          <TabsTrigger value="houses" className="cursor-pointer">Houses</TabsTrigger>
          <TabsTrigger value="friends" className="cursor-pointer">Friends</TabsTrigger>
          <TabsTrigger value="seasonal" className="cursor-pointer">Seasonal</TabsTrigger>
        </TabsList>
        <TabsContent value="global" className="arena-card rounded-xl border border-primary/20 p-4">
          <LeaderboardTable entries={global} />
        </TabsContent>
        <TabsContent value="houses" className="arena-card rounded-xl border border-primary/20 p-4">
          <LeaderboardTable entries={houses} />
        </TabsContent>
        <TabsContent value="friends" className="arena-card rounded-xl border border-primary/20 p-4">
          <LeaderboardTable entries={friends} />
        </TabsContent>
        <TabsContent value="seasonal" className="arena-card rounded-xl border border-primary/20 p-4">
          <LeaderboardTable entries={seasonal} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
