"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { Play, LogIn, Swords, Trophy, Users, Mic, BookOpen } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { useSound } from "@/providers/sound-provider";

export function LandingHero() {
  const { play } = useSound();

  return (
    <section className="relative min-h-[90vh] flex items-center overflow-hidden">
      <div className="absolute inset-0">
        <Image
          src="/assets/hero-arena.png"
          alt="Bughouse Arena"
          fill
          className="object-cover opacity-40"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/20 via-background/80 to-background" />
        <div className="arena-scanlines absolute inset-0 pointer-events-none opacity-20" />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-6 py-24 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <p className="mb-4 text-sm uppercase tracking-[0.3em] text-secondary neon-text">
            Bughouse Chess &amp; Variants
          </p>
          <h1 className="font-heading text-5xl md:text-7xl font-bold mb-6 neon-glow">
            Bughouse Arena
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground mb-6">
            The ultimate platform for Bughouse Chess and chess variants. Team up,
            drop pieces, climb ladders — or play Standard, Crazyhouse, and Atomic 1v1.
          </p>
          <ul className="mx-auto mb-10 flex flex-wrap justify-center gap-3 text-sm">
            <li className="rounded-full border border-primary/40 bg-primary/15 px-3 py-1 text-primary">
              ★ Bughouse 2v2 · Featured
            </li>
            <li className="rounded-full border border-white/15 px-3 py-1 text-muted-foreground">
              Standard Chess
            </li>
            <li className="rounded-full border border-white/15 px-3 py-1 text-muted-foreground">
              Crazyhouse
            </li>
            <li className="rounded-full border border-white/15 px-3 py-1 text-muted-foreground">
              Atomic
            </li>
          </ul>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/app/loader"
              onClick={() => play("matchStart")}
              className={cn(
                buttonVariants({ size: "lg" }),
                "btn-arena-primary text-lg px-8 py-6 cursor-pointer"
              )}
            >
              <Play className="mr-2 h-5 w-5" />
              Play Now
            </Link>
            <Link
              href="/login"
              onClick={() => play("uiClick")}
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "text-lg px-8 py-6 cursor-pointer border-primary/50 hover:border-primary"
              )}
            >
              <LogIn className="mr-2 h-5 w-5" />
              Login
            </Link>
          </div>
          <Link
            href="/rules"
            onClick={() => play("uiClick")}
            className="inline-flex items-center gap-2 mt-8 text-sm text-muted-foreground hover:text-secondary transition-colors cursor-pointer"
          >
            <BookOpen className="h-4 w-4" />
            New to bughouse? Read the rules & how to play
          </Link>
        </motion.div>
      </div>
    </section>
  );
}

const features = [
  {
    icon: Swords,
    title: "Casual & Ranked",
    description: "Queue for fast casual games or climb the ranked ladder with ELO matchmaking.",
  },
  {
    icon: Users,
    title: "Houses & Friends",
    description: "Form guilds, chat in House Halls, invite friends, and compete together.",
  },
  {
    icon: Trophy,
    title: "Leaderboards",
    description: "Global, seasonal, house, and friends leaderboards with rank badges.",
  },
  {
    icon: Mic,
    title: "Team Voice Chat",
    description: "Coordinate drops and attacks with built-in WebRTC voice during matches.",
  },
];

export function FeatureGrid() {
  return (
    <section className="py-24 px-6">
      <div className="mx-auto max-w-6xl">
        <h2 className="font-heading text-3xl md:text-4xl text-center mb-4">
          Built for Competitive Bughouse
        </h2>
        <p className="text-center text-muted-foreground mb-16 max-w-xl mx-auto">
          Everything you need for serious 4-player team chess — synced boards, voice, and social systems.
        </p>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              viewport={{ once: true }}
              className="arena-card p-6 rounded-xl border border-primary/20 bg-card/50 backdrop-blur-sm hover:border-primary/50 transition-all duration-200 cursor-default"
            >
              <feature.icon className="h-10 w-10 text-primary mb-4" />
              <h3 className="font-heading text-lg mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function LandingFooter() {
  return (
    <footer className="border-t border-border/50 py-12 px-6">
      <div className="mx-auto max-w-6xl flex flex-col md:flex-row items-center justify-between gap-6">
        <p className="font-heading text-xl neon-glow">Bughouse Arena</p>
        <nav className="flex flex-wrap items-center justify-center gap-6 text-sm">
          <Link
            href="/rules"
            className="text-muted-foreground hover:text-primary transition-colors cursor-pointer"
          >
            Rules & How to Play
          </Link>
          <InstallPrompt />
        </nav>
        <p className="text-sm text-muted-foreground">
          Install the app for the full arena experience.
        </p>
      </div>
    </footer>
  );
}
