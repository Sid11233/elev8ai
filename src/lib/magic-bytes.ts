// Sniffs a file's real type from its leading bytes, so a renamed executable (or
// any other mismatched file) can't slip past an extension/MIME check. Covers the
// types the job-assets uploader allows; anything else is rejected.

const SIGNATURES: { mime: string; bytes: (number | null)[] }[] = [
  { mime: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47] },
  { mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  { mime: "image/webp", bytes: [0x52, 0x49, 0x46, 0x46, null, null, null, null, 0x57, 0x45, 0x42, 0x50] },
  { mime: "application/pdf", bytes: [0x25, 0x50, 0x44, 0x46] },
  { mime: "application/zip", bytes: [0x50, 0x4b, 0x03, 0x04] }, // also docx/xlsx/pptx (zip-based)
  { mime: "video/mp4", bytes: [null, null, null, null, 0x66, 0x74, 0x79, 0x70] },
  { mime: "video/quicktime", bytes: [null, null, null, null, 0x66, 0x74, 0x79, 0x70, 0x71, 0x74] },
  { mime: "video/webm", bytes: [0x1a, 0x45, 0xdf, 0xa3] },
  { mime: "audio/mpeg", bytes: [0x49, 0x44, 0x33] }, // mp3 with ID3 tag
  { mime: "audio/wav", bytes: [0x52, 0x49, 0x46, 0x46, null, null, null, null, 0x57, 0x41, 0x56, 0x45] },
];

// Executable signatures to explicitly reject regardless of extension/MIME.
const EXECUTABLE_SIGNATURES: (number | null)[][] = [
  [0x4d, 0x5a], // Windows PE (MZ)
  [0x7f, 0x45, 0x4c, 0x46], // Linux ELF
  [0xca, 0xfe, 0xba, 0xbe], // Mach-O (fat binary) / Java class
  [0xfe, 0xed, 0xfa, 0xce], // Mach-O 32-bit
  [0xfe, 0xed, 0xfa, 0xcf], // Mach-O 64-bit
  [0x23, 0x21], // shebang script (#!)
];

function matches(buf: Buffer, sig: (number | null)[]): boolean {
  if (buf.length < sig.length) return false;
  return sig.every((b, i) => b === null || buf[i] === b);
}

export type SniffResult = { ok: true; detected: string } | { ok: false; reason: string };

// Plain-text formats (txt, m4a-as-mp4-container, docx as zip, etc.) can't all be
// magic-byte verified perfectly; we allow the declared MIME to pass through for
// text/plain and m4a (an mp4 container) since those have no unique universal
// signature, but we always reject known executable signatures first.
export function sniffFile(buf: Buffer, declaredMime: string): SniffResult {
  if (EXECUTABLE_SIGNATURES.some((sig) => matches(buf, sig))) {
    return { ok: false, reason: "This looks like an executable file, which isn't allowed" };
  }
  for (const sig of SIGNATURES) {
    if (matches(buf, sig.bytes)) {
      return { ok: true, detected: sig.mime };
    }
  }
  if (declaredMime === "text/plain" || declaredMime === "audio/mp4" || declaredMime === "audio/x-m4a") {
    return { ok: true, detected: declaredMime };
  }
  return { ok: false, reason: "Couldn't verify this file's type" };
}
