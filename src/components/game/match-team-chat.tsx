"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QUICK_CHAT_TEMPLATES } from "@/lib/game/quick-chat-templates";
import {
  sendMatchTeamChat,
  subscribeMatchTeamChat,
} from "@/lib/game/match-chat-service";
import { cn } from "@/lib/utils";

interface MatchTeamChatProps {
  matchId: string;
  team: 1 | 2;
  myUid: string;
  myDisplayName: string;
  disabled?: boolean;
}

export function MatchTeamChat({
  matchId,
  team,
  myUid,
  myDisplayName,
  disabled = false,
}: MatchTeamChatProps) {
  const [chatText, setChatText] = useState("");
  const [messages, setMessages] = useState<
    { id: string; uid: string; displayName: string; text: string; templateId?: string }[]
  >([]);
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return subscribeMatchTeamChat(matchId, team, setMessages);
  }, [matchId, team]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (text: string, templateId?: string) => {
    if (disabled || sending || !text.trim()) return;
    setSending(true);
    try {
      await sendMatchTeamChat(matchId, team, myUid, myDisplayName, text, templateId);
      if (!templateId) setChatText("");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col rounded-xl border border-primary/25 bg-[#0a0618]/70 h-full min-h-[280px]">
      <div className="flex items-center gap-2 border-b border-primary/20 px-3 py-2.5 text-sm font-medium">
        <MessageCircle className="h-4 w-4 text-secondary shrink-0" />
        <span>Team chat</span>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground ml-auto">
          No mic needed
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5 px-2 py-2 border-b border-primary/15">
        {QUICK_CHAT_TEMPLATES.map((template) => (
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

      <div className="flex-1 min-h-[120px] max-h-[200px] overflow-y-auto px-3 py-2 space-y-2">
        {messages.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">
            Quick-chat your partner or type a message below.
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
          void sendMessage(chatText);
        }}
      >
        <Input
          value={chatText}
          onChange={(e) => setChatText(e.target.value)}
          placeholder="Message your team…"
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
