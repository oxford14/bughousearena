"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { getRankAssetPath, getRankLabel, getRankTier } from "@/lib/game/elo";
import type { UserProfile } from "@/types/firestore";

interface LobbyHeaderProps {
  profile: UserProfile | null;
}

export function LobbyHeader({ profile }: LobbyHeaderProps) {
  const tier = profile ? getRankTier(profile.rating) : "pawn";
  const displayName = profile?.displayName ?? "Player";
  const rating = profile?.rating ?? 1200;
  const coins = profile?.arenaCoins ?? 0;

  return (
    <motion.header
      className="lobby-hud mb-6 overflow-hidden rounded-2xl border border-primary/30 p-4 md:p-5"
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
    >
      <div className="lobby-hud__shine pointer-events-none absolute inset-0" aria-hidden />

      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <motion.div
            className="relative shrink-0"
            animate={{ filter: ["drop-shadow(0 0 8px rgba(124,58,237,0.4))", "drop-shadow(0 0 16px rgba(244,63,94,0.5))", "drop-shadow(0 0 8px rgba(124,58,237,0.4))"] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          >
            <Image
              src="/assets/lobby/arena-emblem.svg"
              alt=""
              width={56}
              height={56}
              className="h-14 w-14"
            />
          </motion.div>
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-secondary neon-text">
              Match Command
            </p>
            <h1 className="font-heading text-2xl md:text-3xl neon-glow">Arena Lobby</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Welcome back, <span className="text-foreground font-medium">{displayName}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <motion.div
            className="lobby-stat-chip flex items-center gap-2 rounded-lg border border-primary/25 px-3 py-2"
            whileHover={{ scale: 1.03 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
          >
            <Image src={getRankAssetPath(tier)} alt="" width={24} height={24} className="h-6 w-6" />
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Rank</p>
              <p className="text-sm font-medium leading-none">{getRankLabel(tier)}</p>
            </div>
          </motion.div>

          <motion.div
            className="lobby-stat-chip rounded-lg border border-primary/25 px-3 py-2"
            whileHover={{ scale: 1.03 }}
          >
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">ELO</p>
            <p className="font-heading text-lg leading-none text-primary">{rating}</p>
          </motion.div>

          <motion.div
            className="lobby-stat-chip rounded-lg border border-accent/30 px-3 py-2"
            whileHover={{ scale: 1.03 }}
          >
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Coins</p>
            <p className="font-heading text-lg leading-none text-accent">{coins}</p>
          </motion.div>

          <Badge variant="secondary" className="lobby-live-badge animate-pulse border border-primary/40">
            LIVE
          </Badge>
        </div>
      </div>
    </motion.header>
  );
}
