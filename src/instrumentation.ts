import * as Sentry from "@sentry/nextjs";

import { scrubSensitiveUrls } from "@/lib/sentry-scrub";

// Server/edge error monitoring. No-ops unless NEXT_PUBLIC_SENTRY_DSN is set.
export async function register() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    // Strip secret payment/verify tokens out of request URLs before they ever
    // leave the app.
    beforeSend: scrubSensitiveUrls,
    beforeSendTransaction: scrubSensitiveUrls,
  });
}

export const onRequestError = Sentry.captureRequestError;
