"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatQueueTime } from "@/lib/format-queue-time";

export type MatchMode = "casual" | "ranked" | "private";

interface MatchModePanelProps {
  mode: MatchMode;
  title: string;
  description: string;
  iconSrc: string;
  accentClass: string;
  searching: boolean;
  queueLabel: string;
  queueElapsedSec?: number;
  canQueue: boolean;
  disabledReason?: string;
  onQueue: () => void;
  onCancel: () => void;
  privateHref?: string;
  timeControlOptions?: readonly { seconds: number; label: string; shortLabel: string }[];
  selectedTimeControl?: number;
  onTimeControlChange?: (seconds: number) => void;
}

export function MatchModePanel({
  mode,
  title,
  description,
  iconSrc,
  accentClass,
  searching,
  queueLabel,
  queueElapsedSec = 0,
  canQueue,
  disabledReason,
  onQueue,
  onCancel,
  privateHref,
  timeControlOptions,
  selectedTimeControl,
  onTimeControlChange,
}: MatchModePanelProps) {
  return (
    <motion.div
      className={cn("lobby-mode-card arena-card relative overflow-hidden rounded-2xl border p-5 md:p-6", accentClass)}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: mode === "casual" ? 0.1 : mode === "ranked" ? 0.15 : 0.2 }}
      whileHover={{ y: -2 }}
    >
      <div className="lobby-mode-card__glow pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full blur-3xl opacity-30" aria-hidden />

      <div className="relative flex flex-col gap-4 md:flex-row md:items-start md:gap-6">
        <motion.div
          className="shrink-0"
          animate={searching ? { scale: [1, 1.05, 1] } : {}}
          transition={{ duration: 1.2, repeat: searching ? Infinity : 0 }}
        >
          <Image src={iconSrc} alt="" width={72} height={72} className="h-16 w-16 md:h-[72px] md:w-[72px]" />
        </motion.div>

        <div className="min-w-0 flex-1">
          <h3 className="font-heading text-xl mb-1">{title}</h3>
          <p className="text-sm text-muted-foreground mb-4">{description}</p>

          {timeControlOptions && timeControlOptions.length > 0 && !searching ? (
            <div className="mb-4">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                Time control
              </p>
              <div className="flex flex-wrap gap-2">
                {timeControlOptions.map((option) => {
                  const active = selectedTimeControl === option.seconds;
                  return (
                    <button
                      key={option.seconds}
                      type="button"
                      disabled={!canQueue}
                      onClick={() => onTimeControlChange?.(option.seconds)}
                      className={cn(
                        "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer",
                        active
                          ? "border-primary bg-primary/20 text-primary"
                          : "border-primary/25 bg-muted/20 text-muted-foreground hover:border-primary/50 hover:text-foreground",
                        !canQueue && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      {option.label}
                      <span className="ml-1.5 text-xs opacity-70">{option.shortLabel}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {mode === "private" && privateHref ? (
            <Link
              href={privateHref}
              className={cn(buttonVariants(), "btn-arena-primary cursor-pointer inline-flex lobby-cta-shimmer")}
            >
              Go to Private Rooms
            </Link>
          ) : searching ? (
            <div className="flex flex-wrap gap-2 items-center">
              <Button disabled className="cursor-pointer lobby-searching-btn">
                <span className="lobby-searching-dots">{queueLabel}</span>
              </Button>
              <span
                className="inline-flex items-center rounded-md border border-primary/35 bg-primary/10 px-3 py-2 font-heading text-sm tabular-nums text-primary"
                aria-label={`Search time ${formatQueueTime(queueElapsedSec)}`}
              >
                {formatQueueTime(queueElapsedSec)}
              </span>
              {canQueue && (
                <Button variant="outline" onClick={onCancel} className="cursor-pointer border-primary/40">
                  Cancel
                </Button>
              )}
            </div>
          ) : (
            <Button
              onClick={onQueue}
              className="btn-arena-primary cursor-pointer lobby-cta-shimmer"
              disabled={!canQueue}
            >
              Find {title}
            </Button>
          )}

          {!canQueue && !searching && disabledReason && (
            <p className="text-xs text-muted-foreground mt-2">{disabledReason}</p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

interface MatchModeTabsProps {
  activeMode: MatchMode;
  onModeChange: (mode: MatchMode) => void;
}

const MODES: { id: MatchMode; label: string; icon: string }[] = [
  { id: "casual", label: "Casual", icon: "/assets/lobby/mode-casual.svg" },
  { id: "ranked", label: "Ranked", icon: "/assets/lobby/mode-ranked.svg" },
  { id: "private", label: "Private", icon: "/assets/lobby/mode-private.svg" },
];

export function MatchModeTabs({ activeMode, onModeChange }: MatchModeTabsProps) {
  return (
    <div className="lobby-mode-tabs mb-4 grid grid-cols-3 gap-2 rounded-xl border border-primary/20 bg-muted/20 p-1.5">
      {MODES.map((m) => {
        const active = activeMode === m.id;
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => onModeChange(m.id)}
            className={cn(
              "relative flex flex-col items-center gap-1 rounded-lg px-2 py-2.5 text-xs font-medium transition-colors cursor-pointer sm:flex-row sm:justify-center sm:gap-2 sm:text-sm",
              active ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {active && (
              <motion.div
                layoutId="lobby-mode-tab"
                className="absolute inset-0 rounded-lg bg-gradient-to-r from-primary to-accent opacity-90"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            <Image src={m.icon} alt="" width={24} height={24} className="relative h-6 w-6" />
            <span className="relative">{m.label}</span>
          </button>
        );
      })}
    </div>
  );
}
