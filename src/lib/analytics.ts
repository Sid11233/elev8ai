import "server-only";

import { after } from "next/server";

// Product analytics events we track (PostHog). Server-side capture keeps the
// client bundle lean and covers the key funnel moments.
export type AnalyticsEvent =
  | "signed_up"
  | "onboarded"
  | "job_applied"
  | "job_accepted"
  | "submission_approved"
  | "payout_paid"
  | "course_viewed"
  | "course_purchased"
  | "assignment_passed";

// Fire-and-forget capture. No-ops when PostHog isn't configured. Runs after the
// response so it never slows the action.
export function track(
  event: AnalyticsEvent,
  distinctId: string,
  properties: Record<string, unknown> = {},
) {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com";
  if (!key || !distinctId) return;

  after(async () => {
    try {
      await fetch(`${host.replace(/\/$/, "")}/capture/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: key,
          event,
          distinct_id: distinctId,
          properties: { ...properties, $lib: "elev8ai-server" },
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (err) {
      console.error("analytics: capture failed", err);
    }
  });
}
