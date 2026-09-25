import * as Sentry from "@sentry/nextjs";

// Browser error monitoring. No-ops unless NEXT_PUBLIC_SENTRY_DSN is set.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  Sentry.init({ dsn, tracesSampleRate: 0.1 });
}

// Lets Next report client navigation errors to Sentry.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
