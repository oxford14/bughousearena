"use client";

import { useEffect } from "react";
import { useAuth } from "@/providers/auth-provider";
import { updateOnlineStatus } from "@/lib/social/friends";
import { PRESENCE_HEARTBEAT_MS } from "@/lib/social/presence";
import type { OnlineStatus } from "@/types/firestore";

async function setStatus(uid: string, status: OnlineStatus): Promise<void> {
  try {
    await updateOnlineStatus(uid, status);
  } catch {
    /* best-effort presence */
  }
}

/**
 * Keeps users/{uid}.onlineStatus + lastOnline fresh for signed-in players.
 * Mount inside AuthProvider so the shell stays warm across pages.
 *
 * Unclean exits often skip the offline write — callers should treat stale
 * lastOnline as offline via resolveOnlineStatus.
 */
export function PresenceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    const uid = user.uid;
    let cancelled = false;

    const currentStatus = (): OnlineStatus =>
      document.visibilityState === "visible" ? "online" : "away";

    void setStatus(uid, currentStatus());

    const onVisibility = () => {
      if (cancelled) return;
      void setStatus(uid, currentStatus());
    };

    const onLeave = () => {
      void setStatus(uid, "offline");
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onLeave);
    window.addEventListener("beforeunload", onLeave);

    const heartbeat = window.setInterval(() => {
      if (cancelled) return;
      void setStatus(uid, currentStatus());
    }, PRESENCE_HEARTBEAT_MS);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onLeave);
      window.removeEventListener("beforeunload", onLeave);
      window.clearInterval(heartbeat);
      void setStatus(uid, "offline");
    };
  }, [user]);

  return <>{children}</>;
}
