import { SOUND_ASSET_VERSION } from "./sounds";

export type MusicTrackId = "lobby" | "matchFound";

export interface MusicTrackDefinition {
  src: string;
  volume: number;
  loop: boolean;
  /** Large lobby BGM streams via HTML5; loop is handled manually for reliability. */
  html5?: boolean;
}

/** Bump when replacing lobby BGM so clients fetch the latest file. */
export const MUSIC_ASSET_VERSION = "2";

/** URL-safe path for lobby BGM asset (filename contains a space). */
export const LOBBY_MUSIC_SRC = `/sounds/Knights%20Garden.wav?v=${MUSIC_ASSET_VERSION}-${SOUND_ASSET_VERSION}`;

export const MUSIC_TRACKS: Record<MusicTrackId, MusicTrackDefinition> = {
  lobby: {
    src: LOBBY_MUSIC_SRC,
    volume: 0.42,
    loop: true,
    html5: true,
  },
  matchFound: {
    src: `/sounds/match-found-stinger.wav?v=${SOUND_ASSET_VERSION}`,
    volume: 0.55,
    loop: false,
    html5: false,
  },
};

export const MUSIC_ASSETS = Object.values(MUSIC_TRACKS).map((t) => t.src);
