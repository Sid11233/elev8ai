import "server-only";

import { createHash } from "node:crypto";

// Signed Bunny Stream embed URL. Requires "Embed View Token Authentication" on
// the library. Token = SHA256(tokenKey + videoId + expires), per Bunny docs.
// Returns null when Bunny isn't configured yet, so the UI can show a fallback.
export function signBunnyEmbedUrl(videoId: string, ttlSeconds = 4 * 60 * 60): string | null {
  const libraryId = process.env.BUNNY_STREAM_LIBRARY_ID;
  const tokenKey = process.env.BUNNY_STREAM_TOKEN_KEY;
  if (!libraryId || !tokenKey || !videoId) return null;

  const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
  const token = createHash("sha256").update(`${tokenKey}${videoId}${expires}`).digest("hex");
  const params = new URLSearchParams({
    token,
    expires: String(expires),
    autoplay: "false",
    preload: "true",
  });
  return `https://iframe.mediadelivery.net/embed/${libraryId}/${videoId}?${params}`;
}
