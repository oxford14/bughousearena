"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import {
  formatMatchMode,
  formatMatchResult,
  subscribeToMatchHistory,
} from "@/lib/social/match-history";
import type { MatchHistoryEntry } from "@/types/firestore";

export default function MatchHistoryPage() {
  const { user } = useAuth();
  const [history, setHistory] = useState<MatchHistoryEntry[]>([]);

  useEffect(() => {
    if (!user) return;
    return subscribeToMatchHistory(user.uid, setHistory);
  }, [user]);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="font-heading text-3xl neon-glow">Match History</h1>

      <Card className="arena-card border-primary/20">
        <CardHeader>
          <CardTitle className="font-heading">All Games</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {history.length === 0 && (
            <p className="text-sm text-muted-foreground">No matches recorded yet.</p>
          )}
          {history.map((entry) => (
            <div
              key={entry.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg bg-muted/20"
            >
              <div>
                <p className="font-medium">{formatMatchMode(entry.mode)}</p>
                <p className="text-xs text-muted-foreground">
                  vs {entry.opponents.join(", ")} · {Math.floor(entry.duration / 60)}m
                </p>
              </div>
              <div className="flex items-center gap-2">
                {entry.ratingChange !== 0 && (
                  <span className={`text-sm ${entry.ratingChange > 0 ? "text-green-400" : "text-red-400"}`}>
                    {entry.ratingChange > 0 ? "+" : ""}{entry.ratingChange}
                  </span>
                )}
                <Badge variant={entry.result === "win" ? "default" : "secondary"}>
                  {formatMatchResult(entry.result)}
                </Badge>
                <Link
                  href={`/app/match/${entry.matchId}/replay`}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "cursor-pointer"
                  )}
                >
                  <RotateCcw className="mr-1 h-3.5 w-3.5" />
                  Replay
                </Link>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
