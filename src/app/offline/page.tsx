"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function OfflinePage() {
  const [confirmedOffline, setConfirmedOffline] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const redirectIfOnline = () => {
      if (!navigator.onLine) return false;

      const referrer = document.referrer;
      const fallback =
        referrer && referrer.startsWith(window.location.origin) && !referrer.includes("/offline")
          ? referrer
          : "/app/home";
      window.location.replace(fallback);
      return true;
    };

    if (redirectIfOnline()) return;

    setConfirmedOffline(true);

    const handleOnline = () => {
      window.location.reload();
    };

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, []);

  if (!confirmedOffline) {
    return (
      <div className="min-h-screen flex items-center justify-center arena-bg">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center arena-bg">
      <h1 className="font-heading text-3xl neon-glow mb-4">You&apos;re Offline</h1>
      <p className="text-muted-foreground mb-8 max-w-md">
        Bughouse Arena needs an internet connection for multiplayer matches.
        Reconnect to continue playing.
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className={cn(buttonVariants(), "btn-arena-primary cursor-pointer")}
        >
          Retry
        </button>
        <Link
          href="/app/home"
          className={cn(buttonVariants({ variant: "outline" }), "cursor-pointer")}
        >
          Go to Home
        </Link>
      </div>
    </div>
  );
}
