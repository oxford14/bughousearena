"use client";

import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { RankLadderDialog } from "@/components/arena/rank-ladder-dialog";
import type { UserProfile } from "@/types/firestore";
import { cn } from "@/lib/utils";

interface PlayerStatusBarProps {
  profile: UserProfile | null;
  className?: string;
  onTopUp?: () => void;
}

export function PlayerStatusBar({ profile, className, onTopUp }: PlayerStatusBarProps) {
  const rating = profile?.rating ?? 1200;
  const coins = profile?.arenaCoins ?? 0;

  return (
    <div className={cn("flex w-full flex-wrap items-center gap-2", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <motion.div whileHover={{ scale: 1.03 }} transition={{ type: "spring", stiffness: 400, damping: 20 }}>
          <RankLadderDialog rating={rating} variant="chip" />
        </motion.div>

        <motion.div
          className="lobby-stat-chip rounded-lg border border-primary/25 px-3 py-2"
          whileHover={{ scale: 1.03 }}
        >
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">ELO</p>
          <p className="font-heading text-lg leading-none text-primary">{rating}</p>
        </motion.div>

        <motion.div className="lobby-stat-chip rounded-lg border border-accent/30 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Coins</p>
          <p className="font-heading text-lg leading-none text-accent">{coins}</p>
        </motion.div>
      </div>

      <div className="ml-auto flex items-center gap-2">
        {onTopUp && (
          <motion.button
            type="button"
            onClick={onTopUp}
            className="home-topup-inline-btn rounded-lg px-3 py-2 font-heading text-xs uppercase tracking-wide cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            Top Up
          </motion.button>
        )}

        <Badge variant="secondary" className="lobby-live-badge animate-pulse border border-primary/40">
          Online
        </Badge>
      </div>
    </div>
  );
}
