"use client";

import Image from "next/image";
import { motion } from "framer-motion";

const FLOATING_PIECES = [
  { src: "/assets/lobby/chess-knight.svg", className: "left-[4%] top-[12%] w-14 md:w-20", delay: 0, duration: 5.5 },
  { src: "/assets/lobby/chess-pawn.svg", className: "right-[6%] top-[16%] w-12 md:w-16", delay: 0.6, duration: 4.8 },
  { src: "/assets/lobby/chess-knight.svg", className: "left-[8%] bottom-[20%] w-10 md:w-14 opacity-35", delay: 1, duration: 6, flip: true },
  { src: "/assets/lobby/chess-pawn.svg", className: "right-[10%] bottom-[24%] w-11 md:w-14 opacity-45", delay: 0.3, duration: 5.2 },
] as const;

const PARTICLES = Array.from({ length: 22 }, (_, i) => ({
  id: i,
  left: `${5 + ((i * 19) % 90)}%`,
  top: `${8 + ((i * 21) % 80)}%`,
  size: 2 + (i % 3),
  delay: (i % 7) * 0.35,
  duration: 3 + (i % 5),
}));

export function HomeScene({ children }: { children: React.ReactNode }) {
  return (
    <div className="lobby-scene relative min-h-[calc(100dvh-8rem)] overflow-hidden">
      <div className="lobby-scene__bg pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_90%_60%_at_50%_0%,rgba(124,58,237,0.4),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_50%_at_80%_90%,rgba(244,63,94,0.15),transparent)]" />
        <Image
          src="/assets/home/home-hero-glow.svg"
          alt=""
          width={400}
          height={400}
          className="absolute left-1/2 top-[8%] h-64 w-64 -translate-x-1/2 opacity-80 md:h-80 md:w-80"
          priority
        />
        <Image
          src="/assets/lobby/grid-floor.svg"
          alt=""
          fill
          className="object-cover object-bottom opacity-35 mix-blend-screen"
          priority
        />
        <div className="arena-scanlines absolute inset-0 opacity-[0.06]" />
        <div className="lobby-vignette absolute inset-0" />
      </div>

      {PARTICLES.map((p) => (
        <motion.span
          key={p.id}
          className="lobby-particle pointer-events-none absolute rounded-full bg-primary"
          style={{ left: p.left, top: p.top, width: p.size, height: p.size }}
          animate={{ opacity: [0.1, 0.65, 0.1], scale: [1, 1.5, 1] }}
          transition={{ duration: p.duration, repeat: Infinity, delay: p.delay, ease: "easeInOut" }}
          aria-hidden
        />
      ))}

      {FLOATING_PIECES.map((piece, i) => (
        <motion.div
          key={i}
          className={`lobby-float-piece pointer-events-none absolute ${piece.className}`}
          animate={{ y: [0, -16, 0], rotate: "flip" in piece && piece.flip ? [0, -8, 0] : [0, 8, 0] }}
          transition={{
            duration: piece.duration,
            repeat: Infinity,
            delay: piece.delay,
            ease: "easeInOut",
          }}
          aria-hidden
        >
          <Image src={piece.src} alt="" width={80} height={80} className="h-auto w-full drop-shadow-[0_0_14px_rgba(124,58,237,0.55)]" />
        </motion.div>
      ))}

      <div className="relative z-10">{children}</div>
    </div>
  );
}
