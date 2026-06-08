"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MatchReplayViewer } from "@/components/game/match-replay-viewer";
import { subscribeToMatchAndBoards } from "@/lib/game/sync-manager";
import type { MatchDocument } from "@/types/firestore";

export default function MatchReplayPage() {
  const params = useParams();
  const router = useRouter();
  const matchId = params.id as string;
  const [match, setMatch] = useState<MatchDocument | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!matchId) return;

    const unsub = subscribeToMatchAndBoards(matchId, {
      onMatch: (m) => {
        setMatch(m);
        setLoading(false);
      },
      onBoards: () => {},
    });

    return unsub;
  }, [matchId]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!match) {
    return (
      <div className="space-y-4 py-16 text-center">
        <p className="text-muted-foreground">Match not found.</p>
        <Button className="cursor-pointer" onClick={() => router.push("/app/home")}>
          Back to Home
        </Button>
      </div>
    );
  }

  return <MatchReplayViewer match={match} />;
}
