"use client";

import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/providers/auth-provider";
import { SoundProvider } from "@/providers/sound-provider";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <SoundProvider>
        <TooltipProvider>
          {children}
          <Toaster theme="dark" />
        </TooltipProvider>
      </SoundProvider>
    </AuthProvider>
  );
}
