const SW_REGISTER_TIMEOUT_MS = 4_000;

/** Best-effort SW registration — never blocks app boot for long. */
export async function registerArenaServiceWorker(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;

  try {
    await Promise.race([
      navigator.serviceWorker.register("/sw.js"),
      new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error("Service worker registration timed out")),
          SW_REGISTER_TIMEOUT_MS
        );
      }),
    ]);
  } catch {
    /* SW is optional; a stuck or broken worker must not freeze the loader */
  }
}
