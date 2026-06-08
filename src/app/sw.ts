/// <reference lib="webworker" />
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

/** Only show the offline page for real full-page navigations while offline. */
function shouldUseOfflineFallback(request: Request): boolean {
  if (!self.navigator.onLine) {
    if (request.mode === "navigate") return true;
    if (request.destination === "document") return true;
  }

  return false;
}

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
  fallbacks: {
    entries: [
      {
        url: "/offline",
        matcher({ request }) {
          if (request.headers.get("RSC") === "1") return false;
          if (request.headers.get("Next-Router-Prefetch") === "1") return false;
          if (request.url.includes("/_next/")) return false;
          return shouldUseOfflineFallback(request);
        },
      },
    ],
  },
});

serwist.addEventListeners();
