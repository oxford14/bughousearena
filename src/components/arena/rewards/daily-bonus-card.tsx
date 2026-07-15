"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Gift, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DAILY_STREAK_REWARDS,
  computeNextStreak,
  getManilaDateKey,
  getStreakRewardCoins,
} from "@/lib/wallet/daily-bonus-client";
import { claimDailyBonus } from "@/lib/wallet/wallet-api";
import { useAuth } from "@/providers/auth-provider";
import { toast } from "sonner";

interface DailyBonusCardProps {
  autoPrompt?: boolean;
}

export function DailyBonusCard({ autoPrompt = false }: DailyBonusCardProps) {
  const { profile, refreshProfile } = useAuth();
  const [claiming, setClaiming] = useState(false);
  const [showDialog, setShowDialog] = useState(false);

  const todayKey = getManilaDateKey();
  const { streak, alreadyClaimed } = computeNextStreak(
    profile?.lastDailyClaimDateKey,
    profile?.dailyStreak,
    todayKey
  );
  const nextReward = getStreakRewardCoins(
    alreadyClaimed ? (profile?.dailyStreak ?? streak) : streak
  );

  useEffect(() => {
    if (autoPrompt && profile && !alreadyClaimed) {
      setShowDialog(true);
    }
  }, [autoPrompt, profile, alreadyClaimed]);

  const handleClaim = useCallback(async () => {
    setClaiming(true);
    try {
      const result = await claimDailyBonus();
      await refreshProfile();
      if (result.claimed) {
        toast.success(`+${result.coins} Arena Coins! Day ${result.streak} streak.`);
        setShowDialog(false);
      } else {
        toast.message("Already claimed today.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Claim failed.");
    } finally {
      setClaiming(false);
    }
  }, [refreshProfile]);

  const displayStreak = alreadyClaimed ? (profile?.dailyStreak ?? streak) : streak;

  return (
    <>
      <Card className="arena-card border-primary/25 overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Gift className="h-4 w-4 text-primary" />
                <h3 className="font-heading text-sm uppercase tracking-wide">Daily Reward</h3>
              </div>
              <p className="text-xs text-muted-foreground">
                {alreadyClaimed
                  ? "Come back tomorrow for your next reward."
                  : `Claim ${nextReward} coins today — day ${displayStreak} streak.`}
              </p>
            </div>
            <Button
              size="sm"
              className="btn-arena-primary shrink-0"
              disabled={alreadyClaimed || claiming}
              onClick={handleClaim}
            >
              {alreadyClaimed ? "Claimed" : claiming ? "..." : "Claim"}
            </Button>
          </div>
          <div className="mt-3 flex gap-1">
            {DAILY_STREAK_REWARDS.map((coins, index) => {
              const day = index + 1;
              const active = day <= displayStreak;
              const isToday = day === displayStreak && !alreadyClaimed;
              return (
                <div
                  key={day}
                  className={`flex-1 rounded-md border px-1 py-1.5 text-center text-[10px] ${
                    active
                      ? "border-primary/50 bg-primary/15 text-primary"
                      : "border-muted/40 text-muted-foreground"
                  } ${isToday ? "ring-1 ring-accent" : ""}`}
                >
                  <div className="font-medium">{coins}</div>
                  <div className="opacity-70">D{day}</div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {showDialog && !alreadyClaimed ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="arena-card max-w-sm w-full rounded-2xl border border-primary/30 p-6 text-center"
          >
            <Sparkles className="mx-auto h-10 w-10 text-primary mb-3" />
            <h2 className="font-heading text-xl mb-2">Daily Sign-In Bonus</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Day {displayStreak} — collect {nextReward} Arena Coins!
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowDialog(false)}>
                Later
              </Button>
              <Button className="flex-1 btn-arena-primary" disabled={claiming} onClick={handleClaim}>
                Claim
              </Button>
            </div>
          </motion.div>
        </div>
      ) : null}
    </>
  );
}
