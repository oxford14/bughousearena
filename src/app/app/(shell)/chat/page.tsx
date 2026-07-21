"use client";

import { useEffect, useRef, useState } from "react";
import { MessagesSquare, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/providers/auth-provider";
import {
  getWorldChatSinceMs,
  sendWorldChatMessage,
  subscribeToWorldChat,
} from "@/lib/social/world-chat";
import type { WorldChatMessage } from "@/types/firestore";
import { cn } from "@/lib/utils";

export default function WorldChatPage() {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<WorldChatMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return subscribeToWorldChat(setMessages, getWorldChatSinceMs());
  }, []);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  const handleSend = async () => {
    if (!user || !profile || !text.trim() || sending) return;
    setSending(true);
    try {
      await sendWorldChatMessage(
        profile.uid,
        profile.displayName,
        text,
        profile.photoURL ?? user.photoURL
      );
      setText("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 pb-8">
      <div>
        <h1 className="font-heading text-3xl neon-glow flex items-center gap-2">
          <MessagesSquare className="h-7 w-7 text-primary" aria-hidden />
          World Chat
        </h1>
      </div>

      <Card className="arena-card border-primary/20 flex flex-col min-h-[60vh]">
        <CardHeader className="pb-2">
          <CardTitle className="font-heading text-base">Global channel</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col gap-3 pt-0">
          <div
            ref={listRef}
            className="no-scrollbar min-h-[40vh] flex-1 overflow-y-auto space-y-2 rounded-lg bg-muted/20 p-3"
          >
            {messages.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Quiet for the last 10 minutes. Be the first to say hello.
              </p>
            ) : (
              messages.map((msg) => {
                const mine = msg.uid === profile?.uid;
                return (
                  <div
                    key={msg.id}
                    className={cn(
                      "rounded-lg px-3 py-2 text-sm",
                      mine ? "bg-primary/15" : "bg-background/40"
                    )}
                  >
                    <p className="text-xs font-medium text-primary">
                      {msg.displayName}
                      {mine ? " (you)" : ""}
                    </p>
                    <p className="whitespace-pre-wrap break-words text-foreground">
                      {msg.text}
                    </p>
                  </div>
                );
              })
            )}
          </div>

          <div className="flex gap-2">
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Message the world..."
              maxLength={500}
              disabled={!profile || sending}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleSend();
              }}
            />
            <Button
              onClick={() => void handleSend()}
              disabled={!profile || sending || !text.trim()}
              className="cursor-pointer shrink-0"
            >
              <Send className="h-4 w-4" aria-hidden />
              Send
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
