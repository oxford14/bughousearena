/**
 * Copy Fairy-Stockfish WASM assets into public/engine for browser workers.
 * Run: node scripts/copy-engine.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const pkgDir = path.join(root, "node_modules", "fairy-stockfish-nnue.wasm");
const outDir = path.join(root, "public", "engine");

const files = ["stockfish.js", "stockfish.wasm", "stockfish.worker.js"];

if (!fs.existsSync(pkgDir)) {
  console.error("Missing fairy-stockfish-nnue.wasm — run npm install first.");
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });

for (const file of files) {
  const src = path.join(pkgDir, file);
  if (!fs.existsSync(src)) {
    console.error(`Missing engine file: ${src}`);
    process.exit(1);
  }
  const dest = path.join(outDir, file);
  fs.copyFileSync(src, dest);
  console.log(`copied ${path.relative(root, dest)}`);
}
