"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsIOS, useIsStandalone } from "@/hooks/use-is-standalone";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPrompt() {
  const isStandalone = useIsStandalone();
  const isIOS = useIsIOS();
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (isStandalone) return null;

  if (isIOS) {
    return (
      <p className="text-xs text-muted-foreground text-center">
        Tap Share, then &quot;Add to Home Screen&quot; to install Bughouse Arena.
      </p>
    );
  }

  if (!deferredPrompt) return null;

  return (
    <Button
      variant="outline"
      size="sm"
      className="cursor-pointer"
      onClick={async () => {
        await deferredPrompt.prompt();
        setDeferredPrompt(null);
      }}
    >
      <Download className="mr-2 h-4 w-4" />
      Install Arena
    </Button>
  );
}
