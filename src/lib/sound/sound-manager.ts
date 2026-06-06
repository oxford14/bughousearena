import { Howl, Howler } from "howler";
import {
  SOUND_DEFINITIONS,
  SOUND_STORAGE_KEY,
  SOUND_VOLUME_KEY,
  type SoundId,
} from "./sounds";
import { initHowlerAudio } from "./howler-init";

type SoundListener = () => void;

class SoundManager {
  private howls = new Map<SoundId, Howl>();
  private muted = false;
  private masterVolume = 0.85;
  private listeners = new Set<SoundListener>();
  private resumePromise: Promise<void> | null = null;

  constructor() {
    if (typeof window !== "undefined") {
      initHowlerAudio();
      this.muted = localStorage.getItem(SOUND_STORAGE_KEY) === "muted";
      const stored = localStorage.getItem(SOUND_VOLUME_KEY);
      if (stored) {
        const parsed = Number.parseFloat(stored);
        if (!Number.isNaN(parsed)) this.masterVolume = parsed;
      }
      Howler.mute(this.muted);
    }
  }

  private getHowl(id: SoundId): Howl {
    let howl = this.howls.get(id);
    if (!howl) {
      const def = SOUND_DEFINITIONS[id];
      howl = new Howl({
        src: [def.src],
        volume: def.volume * this.masterVolume,
        preload: true,
        html5: false,
        onloaderror: (_id, error) => {
          console.warn(`[sound] failed to load ${def.src}`, error);
        },
      });
      this.howls.set(id, howl);
    }
    return howl;
  }

  private notify() {
    for (const listener of this.listeners) listener();
  }

  subscribe(listener: SoundListener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  isMuted() {
    return this.muted;
  }

  getVolume() {
    return this.masterVolume;
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    Howler.mute(muted);
    if (muted) {
      for (const howl of this.howls.values()) {
        howl.stop();
      }
    }
    if (typeof window !== "undefined") {
      localStorage.setItem(SOUND_STORAGE_KEY, muted ? "muted" : "enabled");
    }
    this.notify();
  }

  toggleMuted() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  setVolume(volume: number) {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    if (typeof window !== "undefined") {
      localStorage.setItem(SOUND_VOLUME_KEY, String(this.masterVolume));
    }
    for (const [id, howl] of this.howls) {
      howl.volume(SOUND_DEFINITIONS[id].volume * this.masterVolume);
    }
    this.notify();
  }

  /** Warm up Howler and resume the audio context (required after user gesture). */
  async resumeAudioContext(): Promise<void> {
    if (typeof window === "undefined") return;

    if (this.resumePromise) {
      await this.resumePromise;
      return;
    }

    this.resumePromise = (async () => {
      this.getHowl("uiClick");
      const ctx = Howler.ctx;
      if (ctx?.state === "suspended") {
        await ctx.resume();
      }
    })();

    try {
      await this.resumePromise;
    } finally {
      this.resumePromise = null;
    }
  }

  preload() {
    for (const id of Object.keys(SOUND_DEFINITIONS) as SoundId[]) {
      this.getHowl(id);
    }
  }

  play(id: SoundId) {
    if (this.muted || typeof window === "undefined") return;

    const howl = this.getHowl(id);
    const playNow = () => {
      howl.play();
    };

    const ctx = Howler.ctx;
    if (ctx?.state === "suspended") {
      void ctx.resume().then(playNow).catch(() => {});
      return;
    }

    if (howl.state() === "unloaded") {
      howl.once("load", playNow);
      howl.load();
      return;
    }

    playNow();
  }
}

export const soundManager = new SoundManager();

export function playSound(id: SoundId) {
  soundManager.play(id);
}

export function unlockAudio() {
  void soundManager.resumeAudioContext();
}
