"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getAvailableQuickChatTemplates,
  getEquippedEmotes,
} from "@/lib/game/match-chat-unlocks";
import { getEmoteById } from "@/lib/game/match-emotes";
import {
  sendMatchTeamChat,
  subscribeMatchTeamChat,
} from "@/lib/game/match-chat-service";
import { getVipLevelFromTopUp } from "@/lib/shop/vip-tiers";
import { VipBadge } from "@/components/arena/vip-badge";
import { useAuth } from "@/providers/auth-provider";
import type { ChatScope, MatchChatMessage } from "@/types/firestore";
import { cn } from "@/lib/utils";

interface MatchTeamChatProps {
  matchId: string;
  team: 1 | 2;
  myUid: string;
  myDisplayName: string;
  disabled?: boolean;
  /** Compact floating panel (mobile dock). */
  docked?: boolean;
  showCloseButton?: boolean;
  onClose?: () => void;
  onMessagesChange?: (messages: MatchChatMessage[]) => void;
  className?: string;
}

export function MatchTeamChat({
  matchId,
  team,
  myUid,
  myDisplayName,
  disabled = false,
  docked = false,
  showCloseButton = false,
  onClose,
  onMessagesChange,
  className,
}: MatchTeamChatProps) {
  const { profile } = useAuth();
  const [chatText, setChatText] = useState("");
  const [scope, setScope] = useState<ChatScope>("team");
  const [messages, setMessages] = useState<MatchChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const quickChatTemplates = getAvailableQuickChatTemplates(profile);
  const equippedEmotes = getEquippedEmotes(profile);
  const myVipLevel = getVipLevelFromTopUp(profile?.totalTopUpCentavos);

  useEffect(() => {
    return subscribeMatchTeamChat(matchId, team, setMessages);
  }, [matchId, team]);

  useEffect(() => {
    onMessagesChange?.(messages);
  }, [messages, onMessagesChange]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (text: string, templateId?: string, emoteId?: string) => {
    if (disabled || sending || !text.trim()) return;
    setSending(true);
    try {
      await sendMatchTeamChat(
        matchId,
        team,
        myUid,
        myDisplayName,
        text,
        scope,
        templateId,
        emoteId,
        myVipLevel
      );
      if (!templateId && !emoteId) setChatText("");
    } catch (error) {
      console.warn("[match-chat] send failed", error);
      toast.error("Could not send message. Try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col rounded-xl border border-primary/25 bg-[#0a0618]/70 h-full",
        docked
          ? "min-h-0 flex-1 border-0 rounded-none bg-[#0a0618]/95 backdrop-blur-md"
          : "min-h-[280px]",
        className
      )}
    >
      <div className="flex items-center gap-2 border-b border-primary/20 px-3 py-2.5 text-sm font-medium shrink-0">
        <MessageCircle className="h-4 w-4 text-secondary shrink-0" />
        <span className="truncate">Match chat</span>
        <div className="ml-auto flex items-center gap-2 shrink-0">
          <div className="flex items-center rounded-full border border-primary/30 p-0.5 text-[11px]">
            {(["team", "all"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setScope(value)}
                className={cn(
                  "rounded-full px-2.5 py-0.5 capitalize transition-colors cursor-pointer",
                  scope === value
                    ? "bg-primary/30 text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {value}
              </button>
            ))}
          </div>
          {showCloseButton ? (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-muted-foreground hover:bg-primary/20 hover:text-foreground transition-colors"
              aria-label="Close chat"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>

      {equippedEmotes.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 px-2 py-2 border-b border-primary/15">
          {equippedEmotes.map((emote) => (
            <button
              key={emote.id}
              type="button"
              disabled={disabled || sending}
              title={emote.label}
              onClick={() => void sendMessage(`${emote.glyph} ${emote.label}`, undefined, emote.id)}
              className={cn(
                "rounded-full border border-secondary/30 px-2.5 py-1 text-base",
                "bg-secondary/10 hover:bg-secondary/20 transition-colors cursor-pointer",
                "disabled:opacity-45 disabled:cursor-not-allowed"
              )}
            >
              {emote.glyph}
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-1.5 px-2 py-2 border-b border-primary/15">
        {quickChatTemplates.map((template) => (
          <button
            key={template.id}
            type="button"
            disabled={disabled || sending}
            onClick={() => void sendMessage(template.text, template.id)}
            className={cn(
              "rounded-full border border-primary/30 px-2.5 py-1 text-[11px]",
              "bg-primary/10 hover:bg-primary/20 hover:border-primary/50",
              "transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
            )}
          >
            {template.label}
          </button>
        ))}
      </div>

      <div
        className={cn(
          "flex-1 overflow-y-auto px-3 py-2 space-y-2 min-h-0",
          docked ? "min-h-[140px]" : "min-h-[120px] max-h-[200px]"
        )}
      >
        {messages.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">
            Quick-chat your partner or type a message below.
          </p>
        ) : (
          messages.map((msg) => {
            const emote = msg.emoteId ? getEmoteById(msg.emoteId) : undefined;
            return (
              <div
                key={msg.id}
                className={cn(
                  "rounded-lg px-2.5 py-1.5",
                  docked ? "text-[15px] leading-snug" : "text-sm",
                  msg.uid === myUid
                    ? "bg-primary/30 ml-6 border border-primary/25"
                    : "bg-white/10 mr-6 border border-white/10",
                  emote && "text-center text-lg"
                )}
              >
                <span className="flex flex-wrap items-center gap-1.5 text-[10px] uppercase tracking-wider text-secondary mb-0.5">
                  <span>{msg.uid === myUid ? "You" : msg.displayName}</span>
                  <VipBadge vipLevel={msg.vipLevel ?? 0} compact />
                  {msg.scope === "all" ? (
                    <span className="rounded-sm bg-secondary/20 px-1 text-[9px] text-secondary">
                      All
                    </span>
                  ) : null}
                </span>
                {emote ? (
                  <span className="block text-2xl" title={emote.label}>
                    {emote.glyph}
                  </span>
                ) : (
                  msg.text
                )}
              </div>
            );
          })
        )}
        <div ref={chatEndRef} />
      </div>

      <form
        className="flex gap-2 border-t border-primary/20 p-2 shrink-0 bg-[#0a0618]/80"
        onSubmit={(e) => {
          e.preventDefault();
          void sendMessage(chatText);
        }}
      >
        <Input
          value={chatText}
          onChange={(e) => setChatText(e.target.value)}
          placeholder={scope === "all" ? "Message everyone…" : "Message your team…"}
          maxLength={500}
          disabled={disabled || sending}
          className="h-9 text-sm"
        />
        <Button
          type="submit"
          size="sm"
          disabled={disabled || sending || !chatText.trim()}
          className="cursor-pointer shrink-0"
        >
          Send
        </Button>
      </form>
    </div>
  );
}
