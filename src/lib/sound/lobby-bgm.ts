import { LOBBY_MUSIC_SRC } from "./music";
import { soundManager } from "./sound-manager";

const FADE_MS = 900;

/** Single native audio element for lobby BGM — avoids Howler HTML5 pool limits. */
class LobbyBgmPlayer {
  private audio: HTMLAudioElement | null = null;
  private fadeTimer: ReturnType<typeof setInterval> | null = null;
  private targetVolume = 0.42;
  private playing = false;

  private getAudio(): HTMLAudioElement {
    if (!this.audio) {
      this.audio = new Audio(LOBBY_MUSIC_SRC);
      this.audio.loop = true;
      this.audio.preload = "auto";
      this.audio.addEventListener("pause", () => {
        if (!this.playing || soundManager.isMuted() || !this.audio) return;
        // Web Audio SFX can pause HTML media on some browsers — resume BGM.
        void this.audio.play().catch(() => {});
      });
    }
    return this.audio;
  }

  private effectiveVolume() {
    return this.targetVolume * soundManager.getVolume();
  }

  isPlaying(): boolean {
    const audio = this.audio;
    return Boolean(audio && this.playing && !audio.paused);
  }

  play() {
    if (typeof window === "undefined" || soundManager.isMuted()) return;

    const audio = this.getAudio();
    const vol = this.effectiveVolume();
    this.playing = true;

    if (this.isPlaying()) {
      return;
    }

    const start = () => {
      if (soundManager.isMuted() || !this.playing) return;
      audio.volume = 0;
      void audio
        .play()
        .then(() => this.fadeTo(vol))
        .catch(() => {
          /* Autoplay blocked until user gesture */
        });
    };

    // Resume without reload — load() would stop an already-buffered track.
    if (audio.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      start();
      return;
    }

    if (audio.networkState === HTMLMediaElement.NETWORK_LOADING) {
      audio.addEventListener("canplaythrough", start, { once: true });
      return;
    }

    audio.addEventListener("canplaythrough", start, { once: true });
    audio.load();
  }

  stop(fadeMs = FADE_MS) {
    this.playing = false;
    const audio = this.audio;
    if (!audio) return;

    if (this.fadeTimer) {
      clearInterval(this.fadeTimer);
      this.fadeTimer = null;
    }

    if (fadeMs <= 0 || audio.paused) {
      audio.pause();
      audio.currentTime = 0;
      return;
    }

    const startVol = audio.volume;
    const steps = 20;
    const stepMs = fadeMs / steps;
    let step = 0;

    this.fadeTimer = setInterval(() => {
      step += 1;
      audio.volume = Math.max(0, startVol * (1 - step / steps));
      if (step >= steps) {
        if (this.fadeTimer) clearInterval(this.fadeTimer);
        this.fadeTimer = null;
        audio.pause();
        audio.currentTime = 0;
      }
    }, stepMs);
  }

  private fadeTo(target: number) {
    const audio = this.audio;
    if (!audio || !this.playing) return;

    if (this.fadeTimer) {
      clearInterval(this.fadeTimer);
      this.fadeTimer = null;
    }

    const startVol = audio.volume;
    const steps = 18;
    const stepMs = FADE_MS / steps;
    let step = 0;

    this.fadeTimer = setInterval(() => {
      step += 1;
      audio.volume = startVol + (target - startVol) * (step / steps);
      if (step >= steps) {
        if (this.fadeTimer) clearInterval(this.fadeTimer);
        this.fadeTimer = null;
        audio.volume = target;
      }
    }, stepMs);
  }

  preload() {
    if (typeof window === "undefined") return;
    const audio = this.getAudio();
    if (this.isPlaying()) return;
    if (audio.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) return;
    if (audio.networkState === HTMLMediaElement.NETWORK_LOADING) return;
    audio.load();
  }
}

export const lobbyBgmPlayer = new LobbyBgmPlayer();
