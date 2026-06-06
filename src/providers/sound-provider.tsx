"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { soundManager, playSound, unlockAudio } from "@/lib/sound/sound-manager";
import { tryStartPendingMusic, musicManager } from "@/lib/sound/music-manager";
import type { SoundId } from "@/lib/sound/sounds";

interface SoundContextValue {
  play: (id: SoundId) => void;
  muted: boolean;
  volume: number;
  setMuted: (muted: boolean) => void;
  toggleMuted: () => boolean;
  setVolume: (volume: number) => void;
  unlock: () => void;
}

const SoundContext = createContext<SoundContextValue | null>(null);

function isSoundToggleTarget(target: EventTarget | null) {
  return target instanceof Element && target.closest("[data-sound-toggle]") !== null;
}

function SoundUnlockListener() {
  const assetsWarmedRef = useRef(false);

  useEffect(() => {
    const unlock = (event: Event) => {
      if (isSoundToggleTarget(event.target)) return;

      if (!assetsWarmedRef.current) {
        assetsWarmedRef.current = true;
        soundManager.preload();
        musicManager.preload();
      }

      void soundManager.resumeAudioContext().then(() => {
        if (!soundManager.isMuted() && !musicManager.isLobbyPlaying()) {
          tryStartPendingMusic();
        }
      });
    };

    document.addEventListener("pointerdown", unlock, { capture: true });
    document.addEventListener("keydown", unlock, { capture: true });

    return () => {
      document.removeEventListener("pointerdown", unlock, { capture: true });
      document.removeEventListener("keydown", unlock, { capture: true });
    };
  }, []);

  return null;
}

export function SoundProvider({ children }: { children: React.ReactNode }) {
  const [muted, setMutedState] = useState(false);
  const [volume, setVolumeState] = useState(0.85);

  useEffect(() => {
    setMutedState(soundManager.isMuted());
    setVolumeState(soundManager.getVolume());
    return soundManager.subscribe(() => {
      setMutedState(soundManager.isMuted());
      setVolumeState(soundManager.getVolume());
    });
  }, []);

  const setMuted = useCallback((value: boolean) => {
    soundManager.setMuted(value);
  }, []);

  const toggleMuted = useCallback(() => soundManager.toggleMuted(), []);

  const setVolume = useCallback((value: number) => {
    soundManager.setVolume(value);
  }, []);

  const unlock = useCallback(() => {
    unlockAudio();
  }, []);

  const value = useMemo<SoundContextValue>(
    () => ({
      play: playSound,
      muted,
      volume,
      setMuted,
      toggleMuted,
      setVolume,
      unlock,
    }),
    [muted, volume, setMuted, toggleMuted, setVolume, unlock]
  );

  return (
    <SoundContext.Provider value={value}>
      <SoundUnlockListener />
      {children}
    </SoundContext.Provider>
  );
}

export function useSound() {
  const ctx = useContext(SoundContext);
  if (!ctx) {
    throw new Error("useSound must be used within SoundProvider");
  }
  return ctx;
}
