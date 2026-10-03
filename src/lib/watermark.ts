import "server-only";

import sharp from "sharp";

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function isWatermarkable(contentType: string | null | undefined) {
  return !!contentType && IMAGE_TYPES.has(contentType);
}

// Repeating diagonal "lockedinnn · preview" watermark across the image, plus a
// downscale so the preview isn't production-quality. Returns a PNG buffer.
export async function watermarkImage(input: Buffer): Promise<Buffer> {
  const base = sharp(input).rotate(); // respect EXIF orientation
  const meta = await base.metadata();
  const w = Math.min(meta.width ?? 1200, 1200);

  const resized = await base.resize({ width: w, withoutEnlargement: true }).toBuffer();
  const r = await sharp(resized).metadata();
  const width = r.width ?? w;
  const height = r.height ?? Math.round(w * 0.6);

  const tile = 220;
  const marks: string[] = [];
  for (let y = 0; y < height + tile; y += tile) {
    for (let x = 0; x < width + tile; x += tile) {
      marks.push(
        `<text x="${x}" y="${y}" font-family="sans-serif" font-size="22" fill="#7a1f2b" fill-opacity="0.28" transform="rotate(-30 ${x} ${y})">lockedinnn · preview</text>`,
      );
    }
  }
  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${marks.join("")}</svg>`;

  return sharp(resized)
    .composite([{ input: Buffer.from(svg), blend: "over" }])
    .png()
    .toBuffer();
}
