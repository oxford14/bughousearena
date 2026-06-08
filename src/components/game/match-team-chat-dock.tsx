"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageCircle } from "lucide-react";
import { MatchTeamChat } from "@/components/game/match-team-chat";
import { useIsMobile } from "@/hooks/use-mobile";
import type { MatchChatMessage } from "@/types/firestore";
import { cn } from "@/lib/utils";

interface MatchTeamChatDockProps {
  matchId: string;
  team: 1 | 2;
  myUid: string;
  myDisplayName: string;
  disabled?: boolean;
}

/** Desktop: sidebar chat. Mobile: sticky floating chat widget (support-box style). */
export function MatchTeamChatDock(props: MatchTeamChatDockProps) {
  const { myUid } = props;
  const isMobile = useIsMobile();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<MatchChatMessage[]>([]);
  const readCountRef = useRef(0);
  const initializedReadRef = useRef(false);

  useEffect(() => setMounted(true), []);

  const handleMessagesChange = useCallback((next: MatchChatMessage[]) => {
    setMessages(next);
  }, []);

  useEffect(() => {
    if (!initializedReadRef.current) {
      readCountRef.current = messages.length;
      initializedReadRef.current = true;
    }
  }, [messages]);

  const openChat = () => {
    readCountRef.current = messages.length;
    setOpen(true);
  };

  const closeChat = () => {
    readCountRef.current = messages.length;
    setOpen(false);
  };

  const unreadFromOthers = open
    ? 0
    : messages.filter((m, i) => i >= readCountRef.current && m.uid !== myUid).length;

  const chatPanel = (
    <MatchTeamChat
      {...props}
      docked={isMobile}
      showCloseButton={isMobile && open}
      onClose={closeChat}
      onMessagesChange={handleMessagesChange}
      className={isMobile ? "flex-1 min-h-0" : "flex-1"}
    />
  );

  if (!mounted) {
    return (
      <div className="hidden lg:flex lg:flex-col lg:min-h-[280px]">
        <MatchTeamChat {...props} />
      </div>
    );
  }

  if (!isMobile) {
    return (
      <div className="hidden lg:flex lg:flex-col lg:min-h-[280px] lg:h-full">
        {chatPanel}
      </div>
    );
  }

  return (
    <>
      {!open ? (
        <button
          type="button"
          onClick={openChat}
          aria-label="Open match chat"
          aria-expanded={false}
          className={cn(
            "fixed z-[60] flex h-14 w-14 cursor-pointer items-center justify-center rounded-full",
            "border-2 border-primary/50 bg-[#0a0618]/95 text-primary shadow-[0_8px_32px_rgba(124,58,237,0.45)]",
            "backdrop-blur-md transition-transform hover:scale-105 active:scale-95",
            "right-4 bottom-[calc(5.75rem+env(safe-area-inset-bottom))]"
          )}
        >
          <MessageCircle className="h-6 w-6" />
          {unreadFromOthers > 0 ? (
            <span
              className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-foreground"
              aria-hidden
            >
              {unreadFromOthers > 9 ? "9+" : unreadFromOthers}
            </span>
          ) : null}
        </button>
      ) : null}

      {open ? (
        <button
          type="button"
          aria-label="Close chat overlay"
          className="fixed inset-0 z-[55] bg-black/55 backdrop-blur-[2px] cursor-pointer"
          onClick={closeChat}
        />
      ) : null}

      <div
        role={open ? "dialog" : undefined}
        aria-label={open ? "Match chat" : undefined}
        aria-hidden={!open}
        className={cn(
          open
            ? cn(
                "fixed z-[60] flex flex-col overflow-hidden",
                "inset-x-3 bottom-[calc(5.75rem+env(safe-area-inset-bottom))]",
                "max-h-[min(72vh,560px)] rounded-2xl",
                "border-2 border-primary/40 bg-[#0a0618]/98 shadow-[0_12px_48px_rgba(0,0,0,0.55)]",
                "sm:inset-x-auto sm:right-4 sm:left-auto sm:w-[min(calc(100vw-2rem),380px)]"
              )
            : "fixed left-[-9999px] top-0 h-px w-px overflow-hidden opacity-0 pointer-events-none"
        )}
      >
        {chatPanel}
      </div>
    </>
  );
}
