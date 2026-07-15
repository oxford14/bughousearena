"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Castle, Trophy, Users } from "lucide-react";
import { PlayerStatusBar } from "@/components/arena/home/player-status-bar";
import { HubActionCard } from "@/components/arena/home/hub-action-card";
import { DailyBonusCard } from "@/components/arena/rewards/daily-bonus-card";
import type { UserProfile } from "@/types/firestore";
import { useSound } from "@/providers/sound-provider";

interface HomeHubProps {
  profile: UserProfile | null;
  onOpenShop: () => void;
  onOpenTopUp: () => void;
}

const QUICK_LINKS = [
  { href: "/app/friends", label: "Friends", icon: Users },
  { href: "/app/leaderboards", label: "Ranks", icon: Trophy },
  { href: "/app/houses", label: "Houses", icon: Castle },
] as const;

export function HomeHub({ profile, onOpenShop, onOpenTopUp }: HomeHubProps) {
  const { play, unlock } = useSound();
  const displayName = profile?.displayName ?? "Player";

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 pb-8 md:max-w-xl">
      <motion.div
        className="lobby-hud relative overflow-hidden rounded-2xl border border-primary/30 p-4"
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="lobby-hud__shine pointer-events-none absolute inset-0" aria-hidden />
        <PlayerStatusBar
          profile={profile}
          className="relative"
          onTopUp={() => {
            play("uiClick");
            onOpenTopUp();
          }}
        />
      </motion.div>

      <motion.section
        className="flex flex-col items-center text-center"
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1, duration: 0.45 }}
      >
        <motion.div className="relative mb-4">
          <motion.div
            className="pointer-events-none absolute inset-0 rounded-full bg-[rgba(124,58,237,0.55)] blur-xl"
            animate={{ opacity: [0.45, 0.85, 0.45] }}
            transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
            aria-hidden
          />
          <motion.div
            className="pointer-events-none absolute inset-0 rounded-full bg-[rgba(244,63,94,0.35)] blur-xl"
            animate={{ opacity: [0.25, 0.65, 0.25] }}
            transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
            aria-hidden
          />
          <Image
            src="/assets/lobby/arena-emblem.svg"
            alt=""
            width={88}
            height={88}
            className="relative z-10 h-20 w-20 md:h-24 md:w-24"
            priority
          />
        </motion.div>
        <h1 className="font-heading text-3xl md:text-4xl neon-glow">Bughouse Arena</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Welcome, <span className="text-foreground font-medium">{displayName}</span>
        </p>
        <p className="mt-2 max-w-xs text-xs text-muted-foreground/80">
          4-player team chess. Queue up, rank up, customize your arena.
        </p>
      </motion.section>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
      >
        <Link
          href="/app/lobby"
          onClick={() => {
            unlock();
            play("uiNav");
          }}
          className="home-play-cta lobby-cta-shimmer btn-arena-primary flex w-full items-center justify-center gap-3 rounded-2xl px-6 py-5 font-heading text-lg uppercase tracking-wider shadow-[0_0_32px_rgba(244,63,94,0.25)] md:text-xl"
        >
          <Image src="/assets/home/btn-play.svg" alt="" width={40} height={40} className="h-10 w-10" />
          Play Now
        </Link>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.4 }}
      >
        <DailyBonusCard autoPrompt />
      </motion.div>

      <motion.div
        className="grid grid-cols-2 gap-3"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
      >
        <HubActionCard
          label="Shop"
          iconSrc="/assets/home/btn-shop.svg"
          variant="shop"
          onClick={() => {
            play("uiClick");
            onOpenShop();
          }}
        />
        <HubActionCard
          label="Events"
          iconSrc="/assets/home/btn-events.svg"
          variant="events"
          href="/app/tournaments"
          onClick={() => play("uiNav")}
        />
      </motion.div>

      <motion.section
        className="grid grid-cols-3 gap-2"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.4 }}
      >
        {QUICK_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            onClick={() => {
              unlock();
              play("uiNav");
            }}
            className="home-hub-card home-hub-card--default flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <link.icon className="h-5 w-5 text-primary drop-shadow-[0_0_6px_rgba(124,58,237,0.5)]" />
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {link.label}
            </span>
          </Link>
        ))}
      </motion.section>
    </div>
  );
}
