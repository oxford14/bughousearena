export type SoundId =
  | "uiClick"
  | "uiTab"
  | "uiNav"
  | "uiSuccess"
  | "uiError"
  | "gameMove"
  | "gameCapture"
  | "gameDrop"
  | "gameSelect"
  | "matchFound"
  | "matchStart"
  | "queuePulse"
  | "loaderComplete";

export interface SoundDefinition {
  src: string;
  volume: number;
}

/** Bump when regenerating WAV files so clients bypass cached silent assets. */
export const SOUND_ASSET_VERSION = "4";

function sfx(path: string) {
  return `${path}?v=${SOUND_ASSET_VERSION}`;
}

export const SOUND_DEFINITIONS: Record<SoundId, SoundDefinition> = {
  uiClick: { src: sfx("/sounds/ui-click.wav"), volume: 0.45 },
  uiTab: { src: sfx("/sounds/ui-tab.wav"), volume: 0.35 },
  uiNav: { src: sfx("/sounds/ui-nav.wav"), volume: 0.4 },
  uiSuccess: { src: sfx("/sounds/ui-success.wav"), volume: 0.5 },
  uiError: { src: sfx("/sounds/ui-error.wav"), volume: 0.45 },
  gameMove: { src: sfx("/sounds/game-move.wav"), volume: 0.55 },
  gameCapture: { src: sfx("/sounds/game-capture.wav"), volume: 0.6 },
  gameDrop: { src: sfx("/sounds/game-drop.wav"), volume: 0.55 },
  gameSelect: { src: sfx("/sounds/game-select.wav"), volume: 0.4 },
  matchFound: { src: sfx("/sounds/match-found.wav"), volume: 0.65 },
  matchStart: { src: sfx("/sounds/match-start.wav"), volume: 0.6 },
  queuePulse: { src: sfx("/sounds/queue-pulse.wav"), volume: 0.25 },
  loaderComplete: { src: sfx("/sounds/loader-complete.wav"), volume: 0.55 },
};

export const SOUND_ASSETS = Object.values(SOUND_DEFINITIONS).map((d) => d.src);

export const SOUND_STORAGE_KEY = "bughousearena-sound";
export const SOUND_VOLUME_KEY = "bughousearena-sound-volume";
