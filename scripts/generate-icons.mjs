/**
 * Generate favicon + PWA icons from the master logo.
 * Run: node scripts/generate-icons.mjs
 */
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const source = path.join(root, "public", "branding", "logo.png");

if (!fs.existsSync(source)) {
  console.error(`Missing master logo at ${source}`);
  process.exit(1);
}

const iconsDir = path.join(root, "public", "icons");
fs.mkdirSync(iconsDir, { recursive: true });

const BG = { r: 15, g: 15, b: 35, alpha: 1 }; // #0F0F23

async function square(size, outPath, { pad = 0 } = {}) {
  const inner = size - pad * 2;
  const resized = await sharp(source)
    .resize(inner, inner, { fit: "cover" })
    .toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background: BG },
  })
    .composite([{ input: resized, left: pad, top: pad }])
    .png()
    .toFile(outPath);
  console.log(`wrote ${path.relative(root, outPath)}`);
}

await square(192, path.join(iconsDir, "icon-192.png"));
await square(512, path.join(iconsDir, "icon-512.png"));
// Maskable: extra padding so OS mask circles don't clip the emblem.
await square(512, path.join(iconsDir, "icon-512-maskable.png"), { pad: 64 });
await square(180, path.join(root, "src", "app", "apple-icon.png"));
await square(64, path.join(root, "src", "app", "icon.png"));

console.log("Done.");
