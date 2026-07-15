import type { PieceSymbol } from "./bughouse-engine";
import {
  buildCrazyhouseFen,
  parseEngineBestMove,
  type ParsedEngineMove,
} from "./crazyhouse-fen";

export interface EngineMoveRequest {
  fen: string;
  captured: string[];
  promotedSquares?: string[];
  uciElo: number;
  skillLevel: number;
  moveTimeMs: number;
}

export interface EngineMoveResult extends ParsedEngineMove {}

let worker: Worker | null = null;
let readyPromise: Promise<boolean> | null = null;
let nextSearchId = 1;
let activeSearchId: number | null = null;

interface PendingSearch {
  resolve: (value: EngineMoveResult | null) => void;
  timer: ReturnType<typeof setTimeout>;
}

const pendingSearches = new Map<number, PendingSearch>();
const searchQueue: Array<{
  id: number;
  request: EngineMoveRequest;
  resolve: (value: EngineMoveResult | null) => void;
}> = [];

/** SharedArrayBuffer requires cross-origin isolation (COOP/COEP on match routes). */
export function isEngineEnvironmentSupported(): boolean {
  return typeof SharedArrayBuffer !== "undefined";
}

function getWorker(): Worker | null {
  if (typeof window === "undefined") return null;
  if (!isEngineEnvironmentSupported()) return null;
  if (!worker) {
    worker = new Worker("/engine/fairy-worker.js");
    worker.onmessage = handleWorkerMessage;
    worker.onerror = (err) => {
      console.warn("[fairy-engine] worker error", err);
      failAllPending("Worker error");
    };
  }
  return worker;
}

function failAllPending(reason: string) {
  for (const [, pending] of pendingSearches) {
    clearTimeout(pending.timer);
    pending.resolve(null);
  }
  pendingSearches.clear();
  activeSearchId = null;
  while (searchQueue.length > 0) {
    searchQueue.shift()?.resolve(null);
  }
  console.warn("[fairy-engine]", reason);
}

function finishSearch(
  id: number,
  result: EngineMoveResult | null
): void {
  const pending = pendingSearches.get(id);
  if (!pending) return;
  clearTimeout(pending.timer);
  pendingSearches.delete(id);
  pending.resolve(result);
  activeSearchId = null;
  void drainSearchQueue();
}

function handleWorkerMessage(event: MessageEvent) {
  const data = event.data as {
    type: string;
    id?: number;
    move?: string | null;
    promotion?: string;
  };

  if (data.type === "ready") return;

  if (data.type === "error") {
    if (data.id != null) {
      finishSearch(data.id, null);
    } else {
      failAllPending("Worker error message");
    }
    return;
  }

  if (data.type === "result" && data.id != null) {
    if (!data.move) {
      finishSearch(data.id, null);
      return;
    }

    const parsed = parseEngineBestMove(data.move);
    if (parsed && data.promotion) {
      parsed.promotion = data.promotion.toLowerCase() as PieceSymbol;
    }
    finishSearch(data.id, parsed);
  }
}

function drainSearchQueue(): void {
  if (activeSearchId != null || searchQueue.length === 0) return;

  const w = getWorker();
  if (!w) {
    while (searchQueue.length > 0) {
      searchQueue.shift()?.resolve(null);
    }
    return;
  }

  const item = searchQueue.shift()!;
  const { id, request, resolve } = item;
  activeSearchId = id;

  let crazyhouseFen: string;
  try {
    crazyhouseFen = buildCrazyhouseFen(
      request.fen,
      request.captured,
      request.promotedSquares ?? []
    );
  } catch {
    activeSearchId = null;
    resolve(null);
    drainSearchQueue();
    return;
  }

  const timer = setTimeout(() => {
    if (!pendingSearches.has(id)) return;
    finishSearch(id, null);
  }, Math.max(request.moveTimeMs + 2000, 3000));

  pendingSearches.set(id, { resolve, timer });

  w.postMessage({
    type: "search",
    id,
    fen: crazyhouseFen,
    uciElo: request.uciElo,
    skillLevel: request.skillLevel,
    moveTimeMs: request.moveTimeMs,
  });
}

/** Warm the WASM engine when entering a bot match (non-blocking). */
export function warmFairyEngine(): void {
  if (!isEngineEnvironmentSupported()) return;
  const w = getWorker();
  if (!w) return;

  if (!readyPromise) {
    readyPromise = new Promise((resolve) => {
      const onReady = (event: MessageEvent) => {
        if (event.data?.type === "ready") {
          w.removeEventListener("message", onReady);
          resolve(true);
        }
        if (event.data?.type === "error") {
          w.removeEventListener("message", onReady);
          resolve(false);
        }
      };
      w.addEventListener("message", onReady);
      w.postMessage({ type: "init" });

      setTimeout(() => {
        w.removeEventListener("message", onReady);
        resolve(false);
      }, 15000);
    });
  }

  void readyPromise;
}

/** Queue a crazyhouse search; returns null on failure/timeout (caller should fallback). */
export async function getEngineMove(
  request: EngineMoveRequest
): Promise<EngineMoveResult | null> {
  if (!isEngineEnvironmentSupported()) return null;

  warmFairyEngine();
  const w = getWorker();
  if (!w) return null;

  const id = nextSearchId++;

  return new Promise((resolve) => {
    searchQueue.push({ id, request, resolve });
    drainSearchQueue();
  });
}

export function terminateFairyEngine(): void {
  if (worker) {
    worker.postMessage({ type: "terminate" });
    worker.terminate();
    worker = null;
  }
  readyPromise = null;
  failAllPending("Engine terminated");
}

export type { ParsedEngineMove };
