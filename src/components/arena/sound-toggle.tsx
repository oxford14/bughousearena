"use client";

import { Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useSound } from "@/providers/sound-provider";

export function SoundToggle({ compact = false }: { compact?: boolean }) {
  const { muted, toggleMuted, play, unlock } = useSound();

  const handleToggle = () => {
    const nowMuted = toggleMuted();
    if (!nowMuted) {
      unlock();
      play("uiClick");
    }
  };

  if (compact) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        data-sound-toggle
        className="cursor-pointer"
        onClick={handleToggle}
        aria-label={muted ? "Unmute sound effects" : "Mute sound effects"}
        aria-pressed={muted}
      >
        {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
      </Button>
    );
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <Label className="text-sm font-medium">Sound & music</Label>
        <p className="text-xs text-muted-foreground">Lobby music, UI clicks, moves, and match alerts</p>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        data-sound-toggle
        className="cursor-pointer shrink-0"
        onClick={handleToggle}
        aria-pressed={muted}
      >
        {muted ? (
          <>
            <VolumeX className="h-4 w-4 mr-2" /> Off
          </>
        ) : (
          <>
            <Volume2 className="h-4 w-4 mr-2" /> On
          </>
        )}
      </Button>
    </div>
  );
}
