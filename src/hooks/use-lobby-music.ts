"use client";

import { useEffect } from "react";
import {
  allowLobbyMusic,
  requestLobbyMusic,
  stopLobbyMusic,
  tryStartPendingMusic,
} from "@/lib/sound/music-manager";
import { useSound } from "@/providers/sound-provider";

/** Starts looping lobby BGM on mount; fades out on leave. Requires a prior user gesture to hear audio. */
export function useLobbyMusic() {
  const { muted } = useSound();

  useEffect(() => {
    allowLobbyMusic();
    requestLobbyMusic();
    tryStartPendingMusic();

    return () => stopLobbyMusic();
  }, []);

  useEffect(() => {
    if (!muted) {
      allowLobbyMusic();
      requestLobbyMusic();
      tryStartPendingMusic();
    }
  }, [muted]);
}
