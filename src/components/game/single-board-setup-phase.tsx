"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BoardThemeSelector } from "@/components/arena/board-theme-selector";
import { PieceSetSelector } from "@/components/arena/piece-set-selector";
import { arenaPieces } from "@/components/game/arena-pieces";
import {
  getSetupSecondsRemaining,
  MATCH_SETUP_DURATION_SEC,
  oppositeColor,
} from "@/lib/game/match-setup";
import {
  finalizeMatchSetup,
  getSetupEndsAtMs,
  submitColorChoice,
} from "@/lib/game/match-setup-service";
import { isBotUid } from "@/lib/game/bots";
import { getGameTypeMeta, normalizeGameType } from "@/lib/game/game-types";
import type { MatchDocument, PlayerColor } from "@/types/firestore";
import { cn } from "@/lib/utils";

interface SingleBoardSetupPhaseProps {
  match: MatchDocument;
  myUid: string;
}

export function SingleBoardSetupPhase({
  match,
  myUid,
}: SingleBoardSetupPhaseProps) {
  const [now, setNow] = useState(Date.now());
  const finalized = useRef(false);
  const gameType = normalizeGameType(match.gameType);
  const meta = getGameTypeMeta(gameType);

  const endsMs = getSetupEndsAtMs(match) ?? Date.now() + MATCH_SETUP_DURATION_SEC * 1000;
  const remaining = getSetupSecondsRemaining(endsMs, now);
  const choices = match.colorChoices ?? {};
  const myChoice = choices[myUid] as PlayerColor | undefined;
  const opponent = match.players.find((p) => p.uid !== myUid);
  const opponentChoice = opponent
    ? (choices[opponent.uid] as PlayerColor | undefined)
    : undefined;

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    if (remaining > 0 || finalized.current) return;
    finalized.current = true;
    void finalizeMatchSetup(match.id);
  }, [remaining, match.id]);

  // Bot opponent mirrors opposite color
  useEffect(() => {
    if (!myChoice || !opponent || !isBotUid(opponent.uid)) return;
    if (choices[opponent.uid]) return;
    void submitColorChoice(match.id, opponent.uid, oppositeColor(myChoice));
  }, [myChoice, opponent, choices, match.id]);

  const handleSelect = (color: PlayerColor) => {
    if (opponentChoice && opponentChoice === color) return;
    void submitColorChoice(match.id, myUid, color);
  };

  const preview = useMemo(() => {
    if (myChoice) return myChoice;
    if (opponentChoice) return oppositeColor(opponentChoice);
    return null;
  }, [myChoice, opponentChoice]);

  return (
    <div className="mx-auto max-w-lg space-y-6 py-8 text-center">
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          {meta.shortLabel} · Color selection
        </p>
        <h1 className="font-heading text-2xl mt-1">Choose your color</h1>
        <p className="text-sm text-muted-foreground mt-2">
          vs {opponent?.displayName ?? "Opponent"} · {remaining}s
        </p>
      </div>

      <div className="flex justify-center gap-4">
        {(["w", "b"] as const).map((color) => {
          const Piece = color === "w" ? arenaPieces.wP : arenaPieces.bP;
          const taken = opponentChoice === color;
          const selected = myChoice === color || preview === color;
          return (
            <button
              key={color}
              type="button"
              disabled={taken && !selected}
              onClick={() => handleSelect(color)}
              className={cn(
                "flex flex-col items-center gap-2 rounded-2xl border-2 px-8 py-6 transition-all",
                taken && !selected
                  ? "cursor-not-allowed opacity-40"
                  : "cursor-pointer",
                selected
                  ? "border-primary bg-primary/15"
                  : "border-primary/30 hover:border-primary/60"
              )}
            >
              <div className="h-16 w-16">
                <Piece />
              </div>
              <span className="font-heading">
                {color === "w" ? "White" : "Black"}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex justify-center gap-3">
        <BoardThemeSelector />
        <PieceSetSelector />
      </div>

      {remaining <= 0 ? (
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Starting…
        </div>
      ) : (
        <Button
          variant="outline"
          className="cursor-pointer"
          disabled={!myChoice}
          onClick={() => {
            // Wait for timer — host can't force early; keep UX simple
          }}
        >
          Waiting for setup timer…
        </Button>
      )}
    </div>
  );
}
