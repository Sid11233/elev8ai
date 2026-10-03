import "server-only";

import { degrees, PDFDocument, rgb, StandardFonts } from "pdf-lib";
import sharp from "sharp";

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function isImage(contentType: string | null | undefined) {
  return !!contentType && IMAGE_TYPES.has(contentType);
}

export function isPdf(contentType: string | null | undefined) {
  return contentType === "application/pdf";
}

export function isWatermarkable(contentType: string | null | undefined) {
  return isImage(contentType) || isPdf(contentType);
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

// Stamp a repeating diagonal "lockedinnn · preview" watermark across every page
// of a PDF. Returns the watermarked PDF bytes.
export async function watermarkPdf(input: Buffer): Promise<Buffer> {
  const pdf = await PDFDocument.load(input, { ignoreEncryption: true });
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const text = "lockedinnn · preview";
  const size = 18;
  const step = 180;

  for (const page of pdf.getPages()) {
    const { width, height } = page.getSize();
    for (let y = 0; y < height + step; y += step) {
      for (let x = -step; x < width; x += step) {
        page.drawText(text, {
          x,
          y,
          size,
          font,
          color: rgb(0.48, 0.12, 0.17),
          opacity: 0.22,
          rotate: degrees(30),
        });
      }
    }
  }
  const bytes = await pdf.save();
  return Buffer.from(bytes);
}
