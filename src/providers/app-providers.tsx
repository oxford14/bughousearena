"use client";

import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { DevServiceWorkerCleanup } from "@/components/dev-sw-cleanup";
import { AuthProvider } from "@/providers/auth-provider";
import { BoardThemeProvider } from "@/providers/board-theme-provider";
import { PieceSetProvider } from "@/providers/piece-set-provider";
import { SoundProvider } from "@/providers/sound-provider";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <BoardThemeProvider>
        <PieceSetProvider>
          <SoundProvider>
            <TooltipProvider>
              <DevServiceWorkerCleanup />
              {children}
              <Toaster theme="dark" />
            </TooltipProvider>
          </SoundProvider>
        </PieceSetProvider>
      </BoardThemeProvider>
    </AuthProvider>
  );
}
