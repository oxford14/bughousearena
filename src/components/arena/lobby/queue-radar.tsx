"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { BOT_QUEUE_TIMEOUT_MS } from "@/lib/game/matchmaking";
import { formatQueueTime } from "@/lib/format-queue-time";

interface QueueRadarProps {
  active: boolean;
  label: string;
  elapsedSec?: number;
  onCancel?: () => void;
}

export function QueueRadar({ active, label, elapsedSec = 0, onCancel }: QueueRadarProps) {
  const botTimeoutSec = Math.ceil(BOT_QUEUE_TIMEOUT_MS / 1000);
  const botInSec = Math.max(0, botTimeoutSec - elapsedSec);
  const showBotHint = elapsedSec >= Math.max(0, botTimeoutSec - 12);

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          className="lobby-radar pointer-events-none fixed inset-0 z-40 flex items-center justify-center md:left-[var(--sidebar-width,0)]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          aria-live="polite"
          aria-label={label}
        >
          <div className="absolute inset-0 bg-background/40 backdrop-blur-[2px]" />
          <div className="relative flex flex-col items-center gap-6 pointer-events-auto">
            <div className="lobby-radar__ring relative h-40 w-40 md:h-52 md:w-52">
              <span className="lobby-radar__sweep absolute inset-0 rounded-full border border-primary/30" />
              <span className="lobby-radar__pulse absolute inset-4 rounded-full border border-primary/50" />
              <span className="lobby-radar__pulse lobby-radar__pulse--delay absolute inset-10 rounded-full border border-accent/40" />
              <span className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
                <span className="font-heading text-2xl md:text-3xl tabular-nums tracking-wider text-foreground neon-text">
                  {formatQueueTime(elapsedSec)}
                </span>
                <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  elapsed
                </span>
              </span>
            </div>
            <motion.p
              className="font-heading text-sm md:text-base text-primary neon-text text-center px-4"
              animate={{ opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              {label}
            </motion.p>
            {onCancel ? (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                className="cursor-pointer border-primary/50 bg-background/90 px-8 shadow-lg backdrop-blur-sm hover:bg-background"
              >
                Cancel search
              </Button>
            ) : null}
            {showBotHint && (
              <motion.p
                className="text-xs text-muted-foreground text-center px-6 max-w-sm"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {botInSec > 0
                  ? `Arena bots fill empty slots in ~${botInSec}s (you + bot partner vs bots)`
                  : "Summoning arena bots…"}
              </motion.p>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
