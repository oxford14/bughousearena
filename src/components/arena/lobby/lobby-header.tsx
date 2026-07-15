"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { PlayerStatusBar } from "@/components/arena/home/player-status-bar";
import type { UserProfile } from "@/types/firestore";

interface LobbyHeaderProps {
  profile: UserProfile | null;
}

export function LobbyHeader({ profile }: LobbyHeaderProps) {
  const displayName = profile?.displayName ?? "Player";

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
          <motion.div className="relative shrink-0">
            <motion.div
              className="pointer-events-none absolute inset-0 rounded-full bg-[rgba(124,58,237,0.45)] blur-lg"
              animate={{ opacity: [0.35, 0.75, 0.35] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              aria-hidden
            />
            <motion.div
              className="pointer-events-none absolute inset-0 rounded-full bg-[rgba(244,63,94,0.3)] blur-lg"
              animate={{ opacity: [0.2, 0.55, 0.2] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 0.35 }}
              aria-hidden
            />
            <Image
              src="/assets/lobby/arena-emblem.svg"
              alt=""
              width={56}
              height={56}
              className="relative z-10 h-14 w-14"
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

        <PlayerStatusBar profile={profile} className="sm:justify-end" />
      </div>
    </motion.header>
  );
}
