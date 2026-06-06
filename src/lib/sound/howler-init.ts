import { Howler } from "howler";

/** All Howler sounds use Web Audio; lobby BGM uses a dedicated HTMLAudioElement. */
export function initHowlerAudio() {
  if (typeof window === "undefined") return;
  Howler.autoUnlock = true;
}
