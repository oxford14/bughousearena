import { Howl, Howler } from "howler";
import { MUSIC_TRACKS, type MusicTrackId } from "./music";
import { initHowlerAudio } from "./howler-init";
import { lobbyBgmPlayer } from "./lobby-bgm";
import { soundManager } from "./sound-manager";

const FADE_MS = 900;

class MusicManager {
  private howls = new Map<Exclude<MusicTrackId, "lobby">, Howl>();
  private playIds = new Map<Exclude<MusicTrackId, "lobby">, number>();
  private activeTrack: MusicTrackId | null = null;
  private pendingTrack: MusicTrackId | null = null;
  private fadeTimer: ReturnType<typeof setTimeout> | null = null;
  private lobbyDismissed = false;
  private initialized = false;

  constructor() {
    if (typeof window !== "undefined") {
      this.ensureInit();
      soundManager.subscribe(() => this.syncWithMute());
    }
  }

  private ensureInit() {
    if (this.initialized) return;
    initHowlerAudio();
    this.initialized = true;
  }

  private getHowl(id: Exclude<MusicTrackId, "lobby">): Howl {
    this.ensureInit();
    let howl = this.howls.get(id);
    if (!howl) {
      const def = MUSIC_TRACKS[id];
      howl = new Howl({
        src: [def.src],
        loop: def.loop,
        volume: def.volume,
        preload: true,
        html5: false,
        onloaderror: (_id, error) => {
          console.warn(`[music] failed to load ${def.src}`, error);
        },
      });
      this.howls.set(id, howl);
    }
    return howl;
  }

  private targetVolume(id: Exclude<MusicTrackId, "lobby">) {
    return MUSIC_TRACKS[id].volume * soundManager.getVolume();
  }

  isLobbyPlaying(): boolean {
    return lobbyBgmPlayer.isPlaying();
  }

  private syncWithMute() {
    if (soundManager.isMuted()) {
      if (this.fadeTimer) {
        clearTimeout(this.fadeTimer);
        this.fadeTimer = null;
      }
      lobbyBgmPlayer.stop(0);
      this.activeTrack = null;

      if (this.pendingTrack && this.pendingTrack !== "lobby") {
        /* keep non-lobby pending */
      } else {
        this.pendingTrack = this.pendingTrack === "lobby" ? null : this.pendingTrack;
      }
      return;
    }

    if (this.pendingTrack === "lobby" && !this.lobbyDismissed) {
      this.tryStartPending();
    }
  }

  requestLobby() {
    this.lobbyDismissed = false;
    this.pendingTrack = "lobby";
    if (!soundManager.isMuted()) {
      this.tryStartPending();
    }
  }

  allowLobbyMusic() {
    this.lobbyDismissed = false;
  }

  tryStartPending() {
    if (soundManager.isMuted() || !this.pendingTrack || this.lobbyDismissed) return;

    if (this.pendingTrack === "lobby") {
      if (this.isLobbyPlaying()) {
        this.activeTrack = "lobby";
        this.pendingTrack = null;
        return;
      }
      this.startLobby();
      return;
    }

    this.startHowlTrack(this.pendingTrack);
  }

  private startLobby() {
    if (soundManager.isMuted() || this.lobbyDismissed) return;
    this.activeTrack = "lobby";
    this.pendingTrack = null;
    lobbyBgmPlayer.play();
  }

  start(id: MusicTrackId, resume = false) {
    if (id === "lobby") {
      this.startLobby();
      return;
    }
    this.startHowlTrack(id, resume);
  }

  private startHowlTrack(id: Exclude<MusicTrackId, "lobby">, resume = false) {
    if (soundManager.isMuted() || typeof window === "undefined") return;

    if (this.activeTrack === "lobby") {
      lobbyBgmPlayer.stop(FADE_MS);
    }

    if (this.activeTrack && this.activeTrack !== id && this.activeTrack !== "lobby") {
      this.stopActiveHowl(FADE_MS);
    }

    this.pendingTrack = id;
    const howl = this.getHowl(id);
    const vol = this.targetVolume(id);

    const begin = () => {
      if (soundManager.isMuted()) return;

      const existingId = this.playIds.get(id);
      if (resume && existingId !== undefined && howl.playing(existingId)) {
        howl.fade(howl.volume(existingId) as number, vol, FADE_MS, existingId);
        this.activeTrack = id;
        this.pendingTrack = null;
        return;
      }

      const playId = howl.play();
      this.playIds.set(id, playId);
      howl.fade(0, vol, FADE_MS, playId);
      this.activeTrack = id;
      this.pendingTrack = null;
    };

    const ctx = Howler.ctx;
    if (ctx?.state === "suspended") {
      void ctx.resume().then(begin).catch(() => {});
      return;
    }

    if (howl.state() === "unloaded") {
      howl.once("load", begin);
      howl.load();
      return;
    }

    begin();
  }

  stopLobby(fadeMs = FADE_MS) {
    if (this.pendingTrack === "lobby") this.pendingTrack = null;
    lobbyBgmPlayer.stop(fadeMs);
    if (this.activeTrack === "lobby") this.activeTrack = null;
  }

  dismissLobbyMusic(fadeMs = 500) {
    this.lobbyDismissed = true;
    if (this.pendingTrack === "lobby") this.pendingTrack = null;
    this.stopLobby(fadeMs);
  }

  private stopActiveHowl(fadeMs: number) {
    if (this.fadeTimer) {
      clearTimeout(this.fadeTimer);
      this.fadeTimer = null;
    }

    const track = this.activeTrack;
    if (!track || track === "lobby") return;

    const howl = this.howls.get(track);
    const playId = this.playIds.get(track);
    if (!howl || playId === undefined) {
      if (this.activeTrack === track) this.activeTrack = null;
      return;
    }

    if (fadeMs <= 0) {
      howl.stop(playId);
      this.activeTrack = null;
      this.playIds.delete(track);
      return;
    }

    const vol = howl.volume(playId) as number;
    howl.fade(vol, 0, fadeMs, playId);
    this.fadeTimer = setTimeout(() => {
      howl.stop(playId);
      if (this.activeTrack === track) this.activeTrack = null;
      this.playIds.delete(track);
      this.fadeTimer = null;
    }, fadeMs);
  }

  preload() {
    if (!lobbyBgmPlayer.isPlaying()) {
      lobbyBgmPlayer.preload();
    }
    this.getHowl("matchFound");
  }

  playMatchFound(fadeLobbyMs = 500) {
    if (typeof window === "undefined") return;

    this.dismissLobbyMusic(fadeLobbyMs);
    if (soundManager.isMuted()) return;

    this.startHowlTrack("matchFound");
  }
}

export const musicManager = new MusicManager();

export function requestLobbyMusic() {
  musicManager.requestLobby();
}

export function stopLobbyMusic(fadeMs?: number) {
  musicManager.stopLobby(fadeMs);
}

export function dismissLobbyMusic(fadeMs?: number) {
  musicManager.dismissLobbyMusic(fadeMs);
}

export function allowLobbyMusic() {
  musicManager.allowLobbyMusic();
}

export function tryStartPendingMusic() {
  musicManager.tryStartPending();
}

export function playMatchFoundMusic() {
  musicManager.playMatchFound();
}
