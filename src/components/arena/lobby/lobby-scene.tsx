"use client";

import Image from "next/image";
import { motion } from "framer-motion";

const FLOATING_PIECES = [
  { src: "/assets/lobby/chess-knight.svg", className: "left-[6%] top-[18%] w-12 md:w-16", delay: 0, duration: 5 },
  { src: "/assets/lobby/chess-pawn.svg", className: "right-[8%] top-[22%] w-10 md:w-14", delay: 0.8, duration: 4.5 },
  { src: "/assets/lobby/chess-knight.svg", className: "right-[14%] bottom-[28%] w-11 md:w-14 opacity-40", delay: 1.2, duration: 6, flip: true },
  { src: "/assets/lobby/chess-pawn.svg", className: "left-[10%] bottom-[32%] w-9 md:w-12 opacity-50", delay: 0.4, duration: 5.5 },
] as const;

const PARTICLES = Array.from({ length: 18 }, (_, i) => ({
  id: i,
  left: `${8 + ((i * 17) % 84)}%`,
  top: `${10 + ((i * 23) % 75)}%`,
  size: 2 + (i % 3),
  delay: (i % 6) * 0.4,
  duration: 3 + (i % 4),
}));

export function LobbyScene({ children }: { children: React.ReactNode }) {
  return (
    <div className="lobby-scene relative min-h-[calc(100dvh-8rem)] overflow-hidden">
      <div className="lobby-scene__bg pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(124,58,237,0.35),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_100%_100%,rgba(244,63,94,0.12),transparent)]" />
        <Image
          src="/assets/lobby/grid-floor.svg"
          alt=""
          fill
          className="object-cover object-bottom opacity-40 mix-blend-screen"
          priority
        />
        <div className="arena-scanlines absolute inset-0 opacity-[0.07]" />
        <div className="lobby-vignette absolute inset-0" />
      </div>

      {PARTICLES.map((p) => (
        <motion.span
          key={p.id}
          className="lobby-particle pointer-events-none absolute rounded-full bg-primary"
          style={{ left: p.left, top: p.top, width: p.size, height: p.size }}
          animate={{ opacity: [0.15, 0.7, 0.15], scale: [1, 1.4, 1] }}
          transition={{ duration: p.duration, repeat: Infinity, delay: p.delay, ease: "easeInOut" }}
          aria-hidden
        />
      ))}

      {FLOATING_PIECES.map((piece, i) => (
        <motion.div
          key={i}
          className={`lobby-float-piece pointer-events-none absolute ${piece.className}`}
          animate={{ y: [0, -14, 0], rotate: "flip" in piece && piece.flip ? [0, -6, 0] : [0, 6, 0] }}
          transition={{
            duration: piece.duration,
            repeat: Infinity,
            delay: piece.delay,
            ease: "easeInOut",
          }}
          aria-hidden
        >
          <Image src={piece.src} alt="" width={64} height={64} className="h-auto w-full drop-shadow-[0_0_12px_rgba(124,58,237,0.5)]" />
        </motion.div>
      ))}

      <div className="relative z-10">{children}</div>
    </div>
  );
}
