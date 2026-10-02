// Generate favicon + app icons from the seal logo.
// Source: public/brand/logo-seal.png (falls back to .jpg).
// Output (App Router auto-wires these): src/app/icon.png (32), src/app/icon-16.png,
// src/app/apple-icon.png (180), and public/favicon.ico-equivalent src/app/favicon.ico.
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");
const candidates = ["public/brand/logo-seal.png", "public/brand/logo-seal.jpg"].map((p) =>
  path.join(root, p),
);
const src = candidates.find((p) => existsSync(p));
if (!src) {
  console.error(
    "No seal image found. Add public/brand/logo-seal.png (or .jpg), then rerun: node scripts/gen-icons.mjs",
  );
  process.exit(1);
}

const input = await readFile(src);
// Square-crop (cover) with a little padding on a parchment background.
async function render(size, pad) {
  const inner = size - pad * 2;
  const art = await sharp(input)
    .resize(inner, inner, { fit: "cover" })
    .toBuffer();
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0xfa, g: 0xf7, b: 0xf0, alpha: 1 },
    },
  })
    .composite([{ input: art, gravity: "center" }])
    .png()
    .toBuffer();
}

const out = (p) => path.join(root, "src/app", p);
await Promise.all([
  render(32, 2).then((b) => sharp(b).toFile(out("icon.png"))),
  render(180, 16).then((b) => sharp(b).toFile(out("apple-icon.png"))),
  render(32, 2).then((b) => sharp(b).toFile(out("favicon.ico"))),
]);
console.log("Wrote src/app/icon.png, apple-icon.png, favicon.ico from", path.relative(root, src));
