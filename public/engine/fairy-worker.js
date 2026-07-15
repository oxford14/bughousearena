/* eslint-disable no-restricted-globals */
/**
 * Fairy-Stockfish UCI worker for bughouse (crazyhouse variant).
 * Loaded from /engine/fairy-worker.js; importScripts resolves relative to this URL.
 */
"use strict";

importScripts("./stockfish.js");

/** @type {import("./stockfish.js") | null} */
let engine = null;
/** @type {Promise<void> | null} */
let initPromise = null;
/** @type {((line: string) => void) | null} */
let pendingBestMove = null;
/** @type {number | null} */
let pendingSearchId = null;

function send(line) {
  if (engine) engine.postMessage(line);
}

function onEngineLine(line) {
  if (typeof line !== "string") return;

  if (line.startsWith("bestmove ")) {
    const rest = line.slice("bestmove ".length).trim();
    const parts = rest.split(/\s+/);
    const move = parts[0] ?? "(none)";
    let promotion;
    const promoIdx = parts.indexOf("promotion");
    if (promoIdx >= 0 && parts[promoIdx + 1]) {
      promotion = parts[promoIdx + 1];
    }
    if (pendingBestMove) {
      pendingBestMove(move === "(none)" ? null : move, promotion);
      pendingBestMove = null;
      pendingSearchId = null;
    }
  }
}

function waitFor(prefix, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      engine.removeMessageListener(listener);
      reject(new Error(`Timeout waiting for ${prefix}`));
    }, timeoutMs);

    function listener(line) {
      if (typeof line === "string" && line.startsWith(prefix)) {
        clearTimeout(timer);
        engine.removeMessageListener(listener);
        resolve(line);
      }
    }

    engine.addMessageListener(listener);
  });
}

async function ensureEngine() {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    engine = await Stockfish();
    engine.addMessageListener(onEngineLine);
    send("uci");
    await waitFor("uciok");
    send("setoption name UCI_Variant value crazyhouse");
    send("setoption name Use NNUE value false");
    send("setoption name Threads value 1");
    send("isready");
    await waitFor("readyok");
  })().catch((err) => {
    initPromise = null;
    throw err;
  });

  return initPromise;
}

async function configureStrength(uciElo, skillLevel) {
  send(`setoption name UCI_LimitStrength value true`);
  send(`setoption name UCI_Elo value ${Math.round(uciElo)}`);
  send(`setoption name Skill Level value ${Math.round(skillLevel)}`);
  send("isready");
  await waitFor("readyok");
}

async function search(id, fen, uciElo, skillLevel, moveTimeMs) {
  await ensureEngine();
  await configureStrength(uciElo, skillLevel);

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingBestMove = null;
      pendingSearchId = null;
      send("stop");
      reject(new Error("Search timeout"));
    }, Math.max(moveTimeMs + 1500, 2500));

    pendingSearchId = id;
    pendingBestMove = (move, promotion) => {
      clearTimeout(timer);
      resolve({ id, move, promotion });
    };

    send(`position fen ${fen}`);
    send(`go movetime ${Math.max(40, Math.round(moveTimeMs))}`);
  });
}

self.onmessage = async (event) => {
  const data = event.data;
  try {
    if (data.type === "init") {
      await ensureEngine();
      self.postMessage({ type: "ready" });
      return;
    }

    if (data.type === "search") {
      const result = await search(
        data.id,
        data.fen,
        data.uciElo,
        data.skillLevel,
        data.moveTimeMs
      );
      self.postMessage({
        type: "result",
        id: result.id,
        move: result.move,
        promotion: result.promotion,
      });
      return;
    }

    if (data.type === "terminate") {
      if (engine) {
        engine.terminate?.();
        engine = null;
      }
      initPromise = null;
      self.postMessage({ type: "terminated" });
    }
  } catch (err) {
    self.postMessage({
      type: "error",
      id: data.id,
      message: err instanceof Error ? err.message : String(err),
    });
  }
};
