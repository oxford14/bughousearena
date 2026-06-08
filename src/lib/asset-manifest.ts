export const GAME_ASSETS = [
  "/assets/hero-arena.png",
  "/assets/loader-bg.png",
  "/assets/lobby/arena-emblem.svg",
  "/assets/home/btn-play.svg",
  "/assets/home/btn-shop.svg",
  "/assets/home/btn-events.svg",
  "/assets/home/home-hero-glow.svg",
  "/assets/lobby/grid-floor.svg",
  "/assets/lobby/mode-casual.svg",
  "/assets/lobby/mode-ranked.svg",
  "/assets/lobby/mode-private.svg",
  "/assets/board-frame.svg",
  "/assets/ranks/pawn.svg",
  "/assets/ranks/knight.svg",
  "/assets/ranks/bishop.svg",
  "/assets/ranks/rook.svg",
  "/assets/ranks/queen.svg",
  "/assets/ranks/king.svg",
  "/assets/houses/default-banner.svg",
  "/assets/houses/default-crest.svg",
  "/icons/icon-512.png",
] as const;

export const LOADER_STAGES = [
  { id: "sw", label: "Registering arena service", weight: 10 },
  { id: "firebase", label: "Connecting to Firebase", weight: 15 },
  { id: "auth", label: "Restoring session", weight: 15 },
  { id: "assets", label: "Loading arena assets", weight: 30 },
  { id: "game", label: "Preparing game engine", weight: 20 },
  { id: "ready", label: "Entering the arena", weight: 10 },
] as const;

export async function preloadAssets(
  onProgress: (percent: number, label: string) => void
): Promise<void> {
  let loaded = 0;
  const total = GAME_ASSETS.length;

  await Promise.all(
    GAME_ASSETS.map(async (src) => {
      await new Promise<void>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = () => resolve();
        img.src = src;
      });
      loaded += 1;
      const assetProgress = 40 + Math.round((loaded / total) * 30);
      onProgress(assetProgress, "Loading arena assets");
    })
  );
}

export async function preloadGameModules(
  onProgress: (percent: number, label: string) => void
): Promise<void> {
  onProgress(75, "Preparing game engine");
  await Promise.all([
    import("@/lib/game/bughouse-rules"),
    import("@/lib/game/board-state"),
    import("chess.js"),
    import("react-chessboard"),
    import("@/lib/sound/sound-manager"),
  ]);
  onProgress(85, "Loading sound effects");
  await preloadSounds();
  onProgress(90, "Preparing game engine");
}

async function preloadSounds(): Promise<void> {
  const { soundManager } = await import("@/lib/sound/sound-manager");
  const { musicManager } = await import("@/lib/sound/music-manager");
  soundManager.preload();
  musicManager.preload();
}
