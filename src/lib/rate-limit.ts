// Centralized rate limiting, applied once in the proxy (middleware) rather than
// instrumented into every individual Server Action / route handler — the
// skill's own guidance lists this as a valid strategy ("middleware-level
// limiting"), and with ~35 Server Action files and growing, hand-adding limits
// to each one would be unmaintainable and inconsistent.
//
// Implementation: in-memory sliding window, keyed by IP + a bucket name.
// This is correct and sufficient for a single long-lived process (local dev,
// a traditional Node server). On Vercel, Next.js middleware runs on the Edge
// runtime across many distributed PoPs with isolated memory per instance, so
// this becomes a best-effort, per-edge-instance limit rather than a hard
// global one — still real protection against a single attacking source
// hammering one PoP, but not a strict global guarantee. For a hard guarantee
// at scale, swap WINDOWS' Map for an Upstash Redis-backed limiter
// (@upstash/ratelimit) — the call sites below don't need to change, only this
// file.
//
// Also used directly by the public payment page (src/lib/payment-request.ts),
// which has its own stricter limit on top of this general one.

type Bucket = { count: number; resetAt: number };
const WINDOWS = new Map<string, Bucket>();

// Clears old entries occasionally so this doesn't grow unbounded on a
// long-lived process. Cheap: only runs when the map is already large.
function sweep() {
  if (WINDOWS.size < 5000) return;
  const now = Date.now();
  for (const [key, bucket] of WINDOWS) {
    if (now > bucket.resetAt) WINDOWS.delete(key);
  }
}

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSeconds: number };

// `key` should already include whatever scoping you want (e.g. `${ip}:${bucket}`).
export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  sweep();
  const now = Date.now();
  const bucket = WINDOWS.get(key);
  if (!bucket || now > bucket.resetAt) {
    WINDOWS.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }
  bucket.count += 1;
  if (bucket.count > limit) {
    return { ok: false, retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  return { ok: true };
}

// Best-effort client IP from standard proxy headers (Vercel sets
// x-forwarded-for). Falls back to a constant so requests without a resolvable
// IP still share one (conservative) bucket rather than bypassing limiting
// entirely.
export function clientIp(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "unknown";
}
