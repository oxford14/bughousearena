"use client";

import { useEffect } from "react";
import Image from "next/image";
import { motion } from "framer-motion";

interface MatchFoundOverlayProps {
  subtitle?: string;
  onComplete: () => void;
  durationMs?: number;
}

const RING_COUNT = 3;

export function MatchFoundOverlay({
  subtitle,
  onComplete,
  durationMs = 2400,
}: MatchFoundOverlayProps) {
  useEffect(() => {
    const timer = window.setTimeout(onComplete, durationMs);
    return () => window.clearTimeout(timer);
  }, [durationMs, onComplete]);

  return (
    <motion.div
      className="match-found-overlay fixed inset-0 z-50 flex items-center justify-center overflow-hidden md:left-[var(--sidebar-width,0)]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      aria-live="assertive"
      role="alert"
    >
      <motion.div
        className="match-found-flash absolute inset-0 bg-primary/40"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.9, 0] }}
        transition={{ duration: 0.65, times: [0, 0.18, 1], ease: "easeOut" }}
      />

      <motion.div
        className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(124,58,237,0.35)_0%,transparent_55%)]"
        initial={{ scale: 0.2, opacity: 0 }}
        animate={{ scale: 1.6, opacity: [0, 1, 0] }}
        transition={{ duration: 1.1, ease: "easeOut" }}
      />

      {Array.from({ length: RING_COUNT }, (_, i) => (
        <motion.span
          key={i}
          className="match-found-ring absolute rounded-full border-2 border-primary/70 shadow-[0_0_30px_rgba(124,58,237,0.45)]"
          style={{ width: 96, height: 96 }}
          initial={{ scale: 0.4, opacity: 0.85 }}
          animate={{ scale: 5.5, opacity: 0 }}
          transition={{
            duration: 1.35,
            delay: i * 0.16,
            ease: [0.22, 1, 0.36, 1],
          }}
        />
      ))}

      <div className="relative z-10 flex flex-col items-center gap-5 px-6 text-center">
        <motion.div
          className="relative"
          initial={{ scale: 0, rotate: -24, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 280, damping: 16, delay: 0.08 }}
        >
          <motion.div
            className="absolute -inset-4 rounded-full bg-primary/25 blur-xl"
            animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.85, 0.5] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
          />
          <Image
            src="/assets/lobby/arena-emblem.svg"
            alt=""
            width={80}
            height={80}
            priority
            className="relative drop-shadow-[0_0_28px_rgba(124,58,237,0.85)]"
          />
        </motion.div>

        <motion.h2
          className="font-heading text-4xl font-bold tracking-[0.2em] text-foreground md:text-6xl neon-text"
          initial={{ scale: 0.45, opacity: 0, y: 28 }}
          animate={{ scale: [0.45, 1.08, 1], opacity: 1, y: 0 }}
          transition={{
            duration: 0.55,
            delay: 0.18,
            times: [0, 0.65, 1],
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          MATCH FOUND
        </motion.h2>

        {subtitle ? (
          <motion.p
            className="max-w-sm text-sm text-muted-foreground md:text-base"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.42, duration: 0.35 }}
          >
            {subtitle}
          </motion.p>
        ) : null}

        <motion.div
          className="flex items-center gap-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.55 }}
        >
          <Image src="/assets/lobby/chess-knight.svg" alt="" width={28} height={28} className="opacity-80" />
          <p className="text-xs uppercase tracking-[0.35em] text-primary/90 lobby-searching-dots">
            Entering arena
          </p>
          <Image src="/assets/lobby/chess-pawn.svg" alt="" width={24} height={24} className="opacity-80" />
        </motion.div>
      </div>
    </motion.div>
  );
}
