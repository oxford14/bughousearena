"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { MessageCircle, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { arenaPieces } from "@/components/game/arena-pieces";
import {
  getSetupSecondsRemaining,
  getTeamPlayers,
  MATCH_SETUP_DURATION_SEC,
  oppositeColor,
  previewTeamAssignment,
} from "@/lib/game/match-setup";
import {
  finalizeMatchSetup,
  getSetupEndsAtMs,
  sendSetupTeamChat,
  submitColorChoice,
  subscribeSetupTeamChat,
} from "@/lib/game/match-setup-service";
import { isBotUid } from "@/lib/game/bots";
import type { MatchDocument, MatchPlayer, PlayerColor } from "@/types/firestore";
import { cn } from "@/lib/utils";

interface MatchSetupPhaseProps {
  match: MatchDocument;
  myUid: string;
  myDisplayName: string;
}

function ColorPawnButton({
  color,
  label,
  selected,
  takenByPartner,
  disabled,
  onSelect,
}: {
  color: PlayerColor;
  label: string;
  selected: boolean;
  takenByPartner: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  const Piece = color === "w" ? arenaPieces.wP : arenaPieces.bP;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "group relative flex flex-col items-center gap-3 rounded-2xl border-2 px-8 py-6 transition-all",
        disabled ? "cursor-not-allowed opacity-45" : "cursor-pointer",
        selected
          ? "border-[#4ade80] bg-[#4ade80]/10 shadow-[0_0_28px_rgba(74,222,128,0.35)]"
          : "border-primary/35 bg-[#12082a]/80 hover:border-primary hover:bg-primary/10"
      )}
    >
      <div className="h-20 w-20 pointer-events-none">
        <Piece />
      </div>
      <span className="font-heading text-lg tracking-wide">{label}</span>
      {takenByPartner && !selected ? (
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Teammate picked
        </span>
      ) : null}
    </button>
  );
}

function TeammateRow({
  player,
  choice,
  previewColor,
}: {
  player: MatchPlayer;
  choice?: PlayerColor;
  previewColor: PlayerColor | null;
}) {
  const assigned = choice ?? previewColor;
  const label =
    assigned === "w" ? "White" : assigned === "b" ? "Black" : "Choosing…";

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/20 bg-card/40 px-3 py-2 text-sm">
      <span className="truncate font-medium">
        {player.displayName}
        {isBotUid(player.uid) ? (
          <span className="text-muted-foreground font-normal"> · Bot</span>
        ) : null}
      </span>
      <span
        className={cn(
          "shrink-0 text-xs uppercase tracking-wider",
          assigned ? "text-secondary" : "text-muted-foreground"
        )}
      >
        {label}
      </span>
    </div>
  );
}

export function MatchSetupPhase({ match, myUid, myDisplayName }: MatchSetupPhaseProps) {
  const me = match.players.find((p) => p.uid === myUid);
  const myTeam = me?.team ?? 1;
  const teammates = useMemo(
    () => getTeamPlayers(match.players, myTeam),
    [match.players, myTeam]
  );
  const partner = teammates.find((p) => p.uid !== myUid);
  const choices = match.colorChoices ?? {};
  const myChoice = choices[myUid];
  const partnerChoice = partner ? choices[partner.uid] : undefined;

  const [secondsLeft, setSecondsLeft] = useState(MATCH_SETUP_DURATION_SEC);
  const [chatText, setChatText] = useState("");
  const [messages, setMessages] = useState<
    { id: string; uid: string; displayName: string; text: string }[]
  >([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const previewColor = previewTeamAssignment(teammates, choices, myUid);
  const partnerPreview = partner
    ? previewTeamAssignment(teammates, choices, partner.uid)
    : null;

  const endsMs = getSetupEndsAtMs(match);

  useEffect(() => {
    if (!endsMs) return;

    const tick = () => {
      setSecondsLeft(getSetupSecondsRemaining(endsMs));
    };

    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [endsMs]);

  useEffect(() => {
    if (secondsLeft > 0) return;

    void finalizeMatchSetup(match.id);
    const retryId = window.setInterval(() => {
      void finalizeMatchSetup(match.id);
    }, 1500);

    return () => window.clearInterval(retryId);
  }, [secondsLeft, match.id]);

  useEffect(() => {
    return subscribeSetupTeamChat(match.id, myTeam, setMessages);
  }, [match.id, myTeam]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSelect = (color: PlayerColor) => {
    if (myChoice === color) return;
    void submitColorChoice(match.id, myUid, color);
  };

  // Bot teammates mirror the human's pick so setup can finish cleanly.
  useEffect(() => {
    if (!myChoice) return;
    for (const bot of teammates.filter((p) => isBotUid(p.uid))) {
      if (choices[bot.uid]) continue;
      void submitColorChoice(match.id, bot.uid, oppositeColor(myChoice));
    }
  }, [choices, match.id, myChoice, teammates]);

  useEffect(() => {
    if (secondsLeft > 0 || !myChoice) return;
    void finalizeMatchSetup(match.id);
  }, [secondsLeft, myChoice, match.id]);

  const handleSendChat = async () => {
    if (!chatText.trim()) return;
    await sendSetupTeamChat(match.id, myTeam, myUid, myDisplayName, chatText);
    setChatText("");
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-background/95 p-4 backdrop-blur-md md:left-[var(--sidebar-width,0)]">
      <motion.div
        className="arena-card w-full max-w-4xl rounded-2xl border border-primary/30 p-6 md:p-8"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex flex-col gap-6 lg:flex-row">
          <div className="flex-1 space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-secondary mb-1">
                  Team {myTeam} · Pre-match
                </p>
                <h1 className="font-heading text-2xl md:text-3xl neon-glow">
                  Choose your color
                </h1>
                <p className="mt-2 text-sm text-muted-foreground max-w-md">
                  Pick white or black before the match starts. If your teammate already chose,
                  you&apos;ll take the other color. Unpicked seats are assigned when time runs out.
                </p>
              </div>
              <div className="flex flex-col items-center rounded-xl border border-primary/40 bg-primary/10 px-6 py-3 min-w-[88px]">
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  Starts in
                </span>
                <span
                  className={cn(
                    "font-heading text-4xl tabular-nums",
                    secondsLeft <= 5 ? "text-accent" : "text-primary"
                  )}
                >
                  {secondsLeft}
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <ColorPawnButton
                color="w"
                label="White"
                selected={myChoice === "w" || (!myChoice && previewColor === "w")}
                takenByPartner={Boolean(partnerChoice === "w")}
                disabled={Boolean(partnerChoice === "w")}
                onSelect={() => handleSelect("w")}
              />
              <ColorPawnButton
                color="b"
                label="Black"
                selected={myChoice === "b" || (!myChoice && previewColor === "b")}
                takenByPartner={Boolean(partnerChoice === "b")}
                disabled={Boolean(partnerChoice === "b")}
                onSelect={() => handleSelect("b")}
              />
            </div>

            {!myChoice && partnerChoice ? (
              <p className="text-center text-sm text-secondary">
                {partner!.displayName} chose {partnerChoice === "w" ? "White" : "Black"} — you&apos;re
                assigned {previewColor === "w" ? "White" : "Black"}.
              </p>
            ) : null}

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                Your team
              </div>
              {teammates.map((player) => (
                <TeammateRow
                  key={player.boardId || player.uid}
                  player={player}
                  choice={choices[player.uid]}
                  previewColor={previewTeamAssignment(teammates, choices, player.uid)}
                />
              ))}
            </div>
          </div>

          <div className="flex w-full lg:w-72 flex-col rounded-xl border border-primary/25 bg-[#0a0618]/70">
            <div className="flex items-center gap-2 border-b border-primary/20 px-3 py-2.5 text-sm font-medium">
              <MessageCircle className="h-4 w-4 text-secondary" />
              Team chat
            </div>
            <div className="flex-1 min-h-[180px] max-h-[240px] overflow-y-auto px-3 py-2 space-y-2">
              {messages.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">
                  Coordinate with your teammate — who takes white?
                </p>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      "text-sm rounded-lg px-2.5 py-1.5",
                      msg.uid === myUid ? "bg-primary/20 ml-4" : "bg-muted/40 mr-4"
                    )}
                  >
                    <span className="text-[10px] uppercase tracking-wider text-secondary block mb-0.5">
                      {msg.uid === myUid ? "You" : msg.displayName}
                    </span>
                    {msg.text}
                  </div>
                ))
              )}
              <div ref={chatEndRef} />
            </div>
            <form
              className="flex gap-2 border-t border-primary/20 p-2"
              onSubmit={(e) => {
                e.preventDefault();
                void handleSendChat();
              }}
            >
              <Input
                value={chatText}
                onChange={(e) => setChatText(e.target.value)}
                placeholder="Message your team…"
                maxLength={500}
                className="h-9 text-sm"
              />
              <Button type="submit" size="sm" className="cursor-pointer shrink-0">
                Send
              </Button>
            </form>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
