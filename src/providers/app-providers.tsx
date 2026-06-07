"use client";

import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/providers/auth-provider";
import { BoardThemeProvider } from "@/providers/board-theme-provider";
import { SoundProvider } from "@/providers/sound-provider";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <BoardThemeProvider>
        <SoundProvider>
          <TooltipProvider>
            {children}
            <Toaster theme="dark" />
          </TooltipProvider>
        </SoundProvider>
      </BoardThemeProvider>
    </AuthProvider>
  );
}
