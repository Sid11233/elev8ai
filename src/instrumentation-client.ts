import * as Sentry from "@sentry/nextjs";

import { scrubSensitiveUrls } from "@/lib/sentry-scrub";

// Browser error monitoring. No-ops unless NEXT_PUBLIC_SENTRY_DSN is set.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    // Strip secret payment/verify tokens out of request URLs before they ever
    // leave the browser.
    beforeSend: scrubSensitiveUrls,
    beforeSendTransaction: scrubSensitiveUrls,
  });
}

// Lets Next report client navigation errors to Sentry.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
