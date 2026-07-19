/**
 * Generate a multi-size favicon.ico (PNG-compressed entries) from the logo.
 * Run: node scripts/generate-favicon.mjs
 */
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const source = path.join(root, "public", "icons", "icon-512.png");
const outPath = path.join(root, "src", "app", "favicon.ico");
const sizes = [16, 32, 48];

if (!fs.existsSync(source)) {
  console.error(`Missing source logo at ${source}`);
  process.exit(1);
}

const pngs = [];
for (const size of sizes) {
  const buf = await sharp(source)
    .resize(size, size, { fit: "cover" })
    .png()
    .toBuffer();
  pngs.push({ size, buf });
}

const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(pngs.length, 4);

const entries = [];
let offset = 6 + pngs.length * 16;
for (const { size, buf } of pngs) {
  const entry = Buffer.alloc(16);
  entry.writeUInt8(size >= 256 ? 0 : size, 0); // width
  entry.writeUInt8(size >= 256 ? 0 : size, 1); // height
  entry.writeUInt8(0, 2); // palette colors
  entry.writeUInt8(0, 3); // reserved
  entry.writeUInt16LE(1, 4); // color planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32LE(buf.length, 8); // size of image data
  entry.writeUInt32LE(offset, 12); // offset of image data
  entries.push(entry);
  offset += buf.length;
}

const ico = Buffer.concat([header, ...entries, ...pngs.map((p) => p.buf)]);
fs.writeFileSync(outPath, ico);
console.log(`wrote ${path.relative(root, outPath)} (${ico.length} bytes, sizes: ${sizes.join(", ")})`);
