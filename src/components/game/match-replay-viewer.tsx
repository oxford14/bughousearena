"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  Home,
  Loader2,
  Pause,
  Play,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { MatchResultBoard } from "@/components/game/match-result-board";
import {
  buildReplayFrames,
  fetchMatchMoves,
  type ReplayFrame,
} from "@/lib/game/match-replay";
import { formatMatchMode } from "@/lib/social/match-history";
import type { MatchDocument } from "@/types/firestore";
import { cn } from "@/lib/utils";

const AUTOPLAY_MS = 900;

interface MatchReplayViewerProps {
  match: MatchDocument;
}

export function MatchReplayViewer({ match }: MatchReplayViewerProps) {
  const [frames, setFrames] = useState<ReplayFrame[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [frameIndex, setFrameIndex] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const moves = await fetchMatchMoves(match.id);
        if (cancelled) return;
        const built = buildReplayFrames(match, moves);
        if (built.length <= 1) {
          setError("No move history was recorded for this match.");
          setFrames([]);
          return;
        }
        setFrames(built);
        setFrameIndex(0);
      } catch {
        if (!cancelled) {
          setError("Could not load match replay.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [match]);

  const currentFrame = frames?.[frameIndex] ?? null;
  const maxIndex = Math.max(0, (frames?.length ?? 1) - 1);

  const goTo = useCallback(
    (index: number) => {
      if (!frames?.length) return;
      setFrameIndex(Math.max(0, Math.min(index, frames.length - 1)));
    },
    [frames]
  );

  useEffect(() => {
    if (!playing || !frames?.length) return;
    const timer = window.setInterval(() => {
      setFrameIndex((prev) => {
        if (prev >= frames.length - 1) {
          setPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, AUTOPLAY_MS);
    return () => window.clearInterval(timer);
  }, [playing, frames]);

  const modeLabel = useMemo(() => formatMatchMode(match.mode), [match.mode]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !currentFrame) {
    return (
      <div className="mx-auto max-w-lg space-y-4 py-16 text-center">
        <p className="text-muted-foreground">{error ?? "Replay unavailable."}</p>
        <Link
          href={`/app/match/${match.id}`}
          className={cn(buttonVariants({ variant: "outline" }), "cursor-pointer")}
        >
          Back to match
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl neon-glow">Match replay</h1>
          <p className="text-sm text-muted-foreground">
            {modeLabel} · {match.players.length} players · {frames!.length - 1} moves
          </p>
        </div>
        <Link
          href="/app/home"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "cursor-pointer")}
        >
          <Home className="mr-1.5 h-4 w-4" />
          Home
        </Link>
      </div>

      <div className="arena-card rounded-xl border border-primary/20 p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className="cursor-pointer"
            onClick={() => goTo(0)}
            disabled={frameIndex === 0}
            aria-label="First move"
          >
            <ChevronFirst className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className="cursor-pointer"
            onClick={() => goTo(frameIndex - 1)}
            disabled={frameIndex === 0}
            aria-label="Previous move"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="default"
            size="sm"
            className="cursor-pointer min-w-[88px]"
            onClick={() => setPlaying((p) => !p)}
            disabled={frameIndex >= maxIndex && !playing}
          >
            {playing ? (
              <>
                <Pause className="mr-1.5 h-4 w-4" />
                Pause
              </>
            ) : (
              <>
                <Play className="mr-1.5 h-4 w-4" />
                Play
              </>
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className="cursor-pointer"
            onClick={() => goTo(frameIndex + 1)}
            disabled={frameIndex >= maxIndex}
            aria-label="Next move"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className="cursor-pointer"
            onClick={() => goTo(maxIndex)}
            disabled={frameIndex >= maxIndex}
            aria-label="Last move"
          >
            <ChevronLast className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>
              Move {frameIndex} / {maxIndex}
            </span>
            <span className="truncate text-right">{currentFrame.label}</span>
          </div>
          <input
            type="range"
            min={0}
            max={maxIndex}
            value={frameIndex}
            onChange={(e) => goTo(Number(e.target.value))}
            className="w-full accent-primary cursor-pointer"
            aria-label="Replay scrubber"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <MatchResultBoard
            physicalId="alpha"
            match={match}
            boards={currentFrame.boards}
            players={match.players}
          />
          <MatchResultBoard
            physicalId="bravo"
            match={match}
            boards={currentFrame.boards}
            players={match.players}
          />
        </div>
      </div>
    </div>
  );
}
