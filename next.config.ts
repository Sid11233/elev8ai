import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// Supabase project host, used to scope the CSP to our own project instead of
// allowing every *.supabase.co project.
let supabaseHost = "*.supabase.co";
try {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    supabaseHost = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host;
  }
} catch {
  // keep the wildcard fallback
}

// Security headers (vibe-security audit). The app handles auth, payments, and
// bank details on a public token-gated page, so clickjacking/sniffing
// protection matters even though this is server-rendered, not an SPA.
// Scoped to this app's actual external dependencies — not a maximal lockdown —
// so legitimate features (Bunny video embeds, Google OAuth, PostHog, Sentry)
// keep working. Tighten further (e.g. script-src nonces) if/when verified.
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  `script-src 'self' 'unsafe-inline'`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' data: blob: https://${supabaseHost}`,
  `font-src 'self' data:`,
  `frame-src 'self' https://iframe.mediadelivery.net`,
  `connect-src 'self' https://${supabaseHost} https://eu.i.posthog.com https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://*.ingest.de.sentry.io`,
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  // GitHub Codespaces forwards the dev server through *.app.github.dev.
  allowedDevOrigins: ["*.app.github.dev"],
  // The floating dev-tools badge sits on top of the sidebar's logout button.
  // Build and runtime errors still open the error overlay.
  devIndicators: false,
  // sharp is used in a server action (submission watermarking); keep it external
  // so it isn't bundled.
  serverExternalPackages: ["sharp"],
  experimental: {
    serverActions: {
      // Avatars are capped at 2 MB by the storage bucket; leave room for form overhead.
      bodySizeLimit: "3mb",
      // In Codespaces the browser may be on localhost (VS Code forwarding) or on
      // *.app.github.dev while the forwarded host is always the latter.
      allowedOrigins: isDev ? ["*.app.github.dev", "localhost:3000"] : [],
    },
  },
  async headers() {
    // Skip CSP in dev: Next's dev server uses inline/eval'd scripts and HMR
    // websockets that a strict policy would block, with no security benefit
    // on localhost.
    if (isDev) return [];
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
