"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/providers/auth-provider";
import { getRankAssetPath, getRankLabel, getRankTier } from "@/lib/game/elo";
import { logOut } from "@/lib/firebase/auth";
import { subscribeToMatchHistory } from "@/lib/social/match-history";
import type { MatchHistoryEntry } from "@/types/firestore";
import { formatMatchMode, formatMatchResult } from "@/lib/social/match-history";
import { formatRankedWinRate } from "@/lib/social/profile-stats";
import { useRouter } from "next/navigation";
import { SoundToggle } from "@/components/arena/sound-toggle";
import { ChangePasswordForm } from "@/components/arena/change-password-form";

export default function ProfilePage() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const [history, setHistory] = useState<MatchHistoryEntry[]>([]);

  useEffect(() => {
    if (!user) return;
    return subscribeToMatchHistory(user.uid, setHistory);
  }, [user]);

  useEffect(() => {
    if (window.location.hash === "#security") {
      document.getElementById("security")?.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  const tier = profile ? getRankTier(profile.rating) : "pawn";
  const wins = profile?.rankedWins ?? 0;
  const losses = profile?.rankedLosses ?? 0;
  const winRate = formatRankedWinRate(wins, losses);

  const handleLogout = async () => {
    await logOut();
    router.push("/");
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="font-heading text-3xl neon-glow">Profile</h1>

      <Card className="arena-card border-primary/20">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={profile?.photoURL ?? user?.photoURL ?? undefined} />
              <AvatarFallback>{profile?.displayName?.[0] ?? "P"}</AvatarFallback>
            </Avatar>
            <div>
              <h2 className="font-heading text-xl">{profile?.displayName}</h2>
              <div className="flex items-center gap-2 mt-1">
                <Image src={getRankAssetPath(tier)} alt="" width={20} height={20} />
                <Badge>{getRankLabel(tier)}</Badge>
                <span className="text-sm text-muted-foreground">{profile?.rating} ELO</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="arena-card border-primary/20 text-center p-4">
          <p className="text-2xl font-heading text-primary">{wins}</p>
          <p className="text-xs text-muted-foreground">Wins</p>
        </Card>
        <Card className="arena-card border-primary/20 text-center p-4">
          <p className="text-2xl font-heading text-primary">{losses}</p>
          <p className="text-xs text-muted-foreground">Losses</p>
        </Card>
        <Card className="arena-card border-primary/20 text-center p-4">
          <p className="text-2xl font-heading text-primary">{winRate}</p>
          <p className="text-xs text-muted-foreground">Win Rate</p>
        </Card>
        <Card className="arena-card border-primary/20 text-center p-4">
          <p className="text-2xl font-heading text-primary">{profile?.arenaCoins ?? 0}</p>
          <p className="text-xs text-muted-foreground">Arena Coins</p>
        </Card>
      </div>

      <Card className="arena-card border-primary/20">
        <CardContent className="pt-6">
          <SoundToggle />
        </CardContent>
      </Card>

      <Card className="arena-card border-primary/20" id="security">
        <CardHeader>
          <CardTitle className="font-heading">Password & security</CardTitle>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>

      <Card className="arena-card border-primary/20">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-heading">Recent Matches</CardTitle>
          <Link
            href="/app/profile/history"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "cursor-pointer")}
          >
            View All
          </Link>
        </CardHeader>
        <CardContent className="space-y-2">
          {history.length === 0 && (
            <p className="text-sm text-muted-foreground">No match history yet.</p>
          )}
          {history.slice(0, 5).map((entry) => (
            <div key={entry.matchId} className="flex justify-between text-sm p-2 rounded bg-muted/20">
              <span>{formatMatchMode(entry.mode)} vs {entry.opponents.join(", ")}</span>
              <Badge variant={entry.result === "win" ? "default" : "secondary"}>
                {formatMatchResult(entry.result)}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <Button variant="outline" onClick={handleLogout} className="cursor-pointer">
        Sign Out
      </Button>
    </div>
  );
}
