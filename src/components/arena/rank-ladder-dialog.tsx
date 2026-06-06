"use client";

import { useState } from "react";
import Image from "next/image";
import { Medal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  formatRankRatingRange,
  getNextRankProgress,
  getRankAssetPath,
  getRankLabel,
  getRankTier,
  RANK_LADDER,
  type RankTier,
} from "@/lib/game/elo";
import { cn } from "@/lib/utils";

interface RankLadderDialogProps {
  rating: number;
  /** Compact icon-only trigger for tight spaces */
  variant?: "icon" | "chip";
  className?: string;
}

export function RankLadderDialog({
  rating,
  variant = "chip",
  className,
}: RankLadderDialogProps) {
  const [open, setOpen] = useState(false);
  const tier = getRankTier(rating);
  const next = getNextRankProgress(rating);

  const trigger =
    variant === "icon" ? (
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className={cn(
          "cursor-pointer text-muted-foreground hover:text-primary hover:bg-primary/10",
          className
        )}
        aria-label="View rank ladder"
      >
        <Medal className="h-4 w-4" />
      </Button>
    ) : (
      <button
        type="button"
        className={cn(
          "lobby-stat-chip flex items-center gap-2 rounded-lg border border-primary/25 px-3 py-2 text-left transition-colors",
          "cursor-pointer hover:border-primary/50 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
          className
        )}
        aria-label="View all ranks"
      >
        <Image
          src={getRankAssetPath(tier)}
          alt=""
          width={24}
          height={24}
          className="h-6 w-6"
        />
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Rank</p>
          <p className="flex items-center gap-1 text-sm font-medium leading-none">
            {getRankLabel(tier)}
            <Medal className="h-3 w-3 text-primary/70" aria-hidden />
          </p>
        </div>
      </button>
    );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md border-primary/30 bg-background/95">
        <DialogHeader>
          <DialogTitle className="font-heading neon-glow">Arena Ranks</DialogTitle>
          <DialogDescription>
            Ranked ELO tiers. Your current standing is highlighted below.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border border-primary/25 bg-primary/5 px-4 py-3">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Your rank
          </p>
          <div className="mt-1 flex items-center gap-3">
            <Image
              src={getRankAssetPath(tier)}
              alt=""
              width={40}
              height={40}
              className="h-10 w-10 drop-shadow-[0_0_12px_rgba(124,58,237,0.45)]"
            />
            <div>
              <p className="font-heading text-xl text-primary">{getRankLabel(tier)}</p>
              <p className="text-sm text-muted-foreground">{rating} ELO</p>
            </div>
          </div>
          {next ? (
            <p className="mt-2 text-xs text-muted-foreground">
              {next.pointsNeeded} ELO to {next.nextLabel}
            </p>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">Highest arena tier reached</p>
          )}
        </div>

        <ul className="max-h-[min(50vh,320px)] space-y-2 overflow-y-auto pr-1">
          {RANK_LADDER.map((entry) => (
            <RankLadderRow
              key={entry.tier}
              entry={entry}
              isCurrent={entry.tier === tier}
            />
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

function RankLadderRow({
  entry,
  isCurrent,
}: {
  entry: (typeof RANK_LADDER)[number];
  isCurrent: boolean;
}) {
  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors",
        isCurrent
          ? "border-primary/60 bg-primary/10 shadow-[0_0_20px_rgba(124,58,237,0.15)]"
          : "border-border/60 bg-muted/20"
      )}
    >
      <Image
        src={getRankAssetPath(entry.tier as RankTier)}
        alt=""
        width={32}
        height={32}
        className={cn("h-8 w-8 shrink-0", isCurrent && "drop-shadow-[0_0_8px_rgba(124,58,237,0.5)]")}
      />
      <div className="min-w-0 flex-1">
        <p className={cn("font-medium leading-none", isCurrent && "text-primary")}>
          {entry.label}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {formatRankRatingRange(entry)}
        </p>
      </div>
      {isCurrent ? (
        <Badge variant="secondary" className="shrink-0 border border-primary/40 text-[10px]">
          You
        </Badge>
      ) : null}
    </li>
  );
}
