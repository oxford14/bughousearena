"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ProfilePhotoUpload } from "@/components/arena/profile-photo-upload";
import { ArenaShopDialog } from "@/components/arena/shop/arena-shop-dialog";
import { PieceSetSelector } from "@/components/arena/piece-set-selector";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/providers/auth-provider";
import { getRankAssetPath, getRankLabel, getRankTier } from "@/lib/game/elo";
import { logOut } from "@/lib/firebase/auth";
import { subscribeToMatchHistory } from "@/lib/social/match-history";
import type { MatchHistoryEntry } from "@/types/firestore";
import { formatMatchMode, formatMatchResult } from "@/lib/social/match-history";
import {
  formatWinRate,
  getModeWinLoss,
  type ModeWinLoss,
} from "@/lib/social/profile-stats";
import { useRouter } from "next/navigation";
import { SoundToggle } from "@/components/arena/sound-toggle";
import { BoardThemeSelector } from "@/components/arena/board-theme-selector";
import { ChangePasswordForm } from "@/components/arena/change-password-form";
import { InviteEarnSection } from "@/components/arena/referrals/invite-earn-section";
import type { UserProfile } from "@/types/firestore";

function getRankedStats(
  history: MatchHistoryEntry[],
  profile: UserProfile | null
): ModeWinLoss {
  const fromHistory = getModeWinLoss(history, "ranked");
  const hasHistory =
    fromHistory.wins + fromHistory.losses + fromHistory.draws > 0;
  if (hasHistory) return fromHistory;
  return {
    wins: profile?.rankedWins ?? 0,
    losses: profile?.rankedLosses ?? 0,
    draws: 0,
  };
}

function ModeWinRateCard({ label, stats }: { label: string; stats: ModeWinLoss }) {
  const winRate = formatWinRate(stats.wins, stats.losses);
  const record = `${stats.wins}W · ${stats.losses}L`;

  return (
    <Card className="arena-card border-primary/20 text-center p-4 flex flex-col justify-center">
      <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
      <p className="text-2xl font-heading text-primary">{winRate}</p>
      <p className="text-xs text-muted-foreground mt-1">{record}</p>
    </Card>
  );
}

export default function ProfilePage() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const [history, setHistory] = useState<MatchHistoryEntry[]>([]);
  const [shopOpen, setShopOpen] = useState(false);

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

  const rankedStats = getRankedStats(history, profile);
  const casualStats = getModeWinLoss(history, "casual");

  const handleLogout = async () => {
    await logOut();
    router.push("/");
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="font-heading text-3xl neon-glow">Profile</h1>

      <Card className="arena-card border-primary/20">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            <ProfilePhotoUpload
              displayName={profile?.displayName ?? "Player"}
              photoURL={profile?.photoURL ?? user?.photoURL}
              frameId={profile?.equippedAvatarFrame}
            />
            <div className="text-center sm:text-left">
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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <ModeWinRateCard label="Ranked" stats={rankedStats} />
        <ModeWinRateCard label="Casual" stats={casualStats} />
        <Card className="arena-card border-primary/20 text-center p-4 flex flex-col justify-center">
          <p className="text-2xl font-heading text-primary">{profile?.arenaCoins ?? 0}</p>
          <p className="text-xs text-muted-foreground">Arena Coins</p>
        </Card>
      </div>

      <InviteEarnSection />

      <Card className="arena-card border-primary/20">
        <CardContent className="pt-6 space-y-6">
          <SoundToggle />
          <BoardThemeSelector onShopRequest={() => setShopOpen(true)} />
          <PieceSetSelector onShopRequest={() => setShopOpen(true)} />
          <Button type="button" variant="outline" onClick={() => setShopOpen(true)}>
            Open Arena Shop
          </Button>
        </CardContent>
      </Card>

      <ArenaShopDialog
        open={shopOpen}
        onOpenChange={setShopOpen}
        profile={profile}
      />

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
            <div
              key={entry.id}
              className="flex items-center justify-between gap-2 text-sm p-2 rounded bg-muted/20"
            >
              <span className="min-w-0 truncate">
                {formatMatchMode(entry.mode)} vs {entry.opponents.join(", ")}
              </span>
              <div className="flex shrink-0 items-center gap-2">
                <Badge variant={entry.result === "win" ? "default" : "secondary"}>
                  {formatMatchResult(entry.result)}
                </Badge>
                <Link
                  href={`/app/match/${entry.matchId}/replay`}
                  className={cn(
                    buttonVariants({ variant: "ghost", size: "xs" }),
                    "cursor-pointer h-7 px-2"
                  )}
                >
                  Replay
                </Link>
              </div>
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
