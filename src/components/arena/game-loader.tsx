"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion } from "framer-motion";
import { Progress } from "@/components/ui/progress";
import {
  LOADER_STAGES,
  preloadAssets,
  preloadGameModules,
} from "@/lib/asset-manifest";
import { getFirebaseApp } from "@/lib/firebase/config";
import { useAuth } from "@/providers/auth-provider";
import { useSound } from "@/providers/sound-provider";

export function GameLoader() {
  const router = useRouter();
  const { user } = useAuth();
  const { play } = useSound();
  const [progress, setProgress] = useState(0);
  const [label, setLabel] = useState<string>(LOADER_STAGES[0]!.label);

  useEffect(() => {
    let cancelled = false;

    async function runLoader() {
      const update = (pct: number, text: string) => {
        if (!cancelled) {
          setProgress(pct);
          setLabel(text);
        }
      };

      update(5, LOADER_STAGES[0]!.label);
      if ("serviceWorker" in navigator) {
        try {
          await navigator.serviceWorker.register("/sw.js");
        } catch {
          /* SW optional in dev */
        }
      }
      update(10, LOADER_STAGES[0]!.label);

      update(15, LOADER_STAGES[1]!.label);
      getFirebaseApp();
      update(25, LOADER_STAGES[1]!.label);

      update(30, LOADER_STAGES[2]!.label);
      await new Promise((r) => setTimeout(r, 400));
      update(40, LOADER_STAGES[2]!.label);

      await preloadAssets(update);
      await preloadGameModules(update);

      update(100, LOADER_STAGES[5]!.label);
      play("loaderComplete");
      await new Promise((r) => setTimeout(r, 600));

      if (!cancelled) {
        router.replace(user ? "/app/lobby" : "/login?next=/app/lobby");
      }
    }

    void runLoader();
    return () => {
      cancelled = true;
    };
  }, [router, user, play]);

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">
      <Image
        src="/assets/loader-bg.png"
        alt=""
        fill
        className="object-cover opacity-30"
        priority
      />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/90 to-background/60" />
      <div className="arena-scanlines absolute inset-0 pointer-events-none opacity-15" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative z-10 w-full max-w-md px-6 text-center"
      >
        <h1 className="font-heading text-3xl mb-2 neon-glow">Bughouse Arena</h1>
        <p className="text-muted-foreground mb-8">{label}</p>

        <div className="relative mb-4">
          <Progress value={progress} className="h-3 bg-muted" />
          <motion.div
            className="absolute -top-1 left-0 h-5 w-1 bg-primary rounded-full shadow-[0_0_12px_#7C3AED]"
            style={{ left: `${Math.min(progress, 98)}%` }}
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ repeat: Infinity, duration: 1.2 }}
          />
        </div>
        <p className="font-heading text-2xl text-primary">{progress}%</p>
      </motion.div>
    </div>
  );
}
