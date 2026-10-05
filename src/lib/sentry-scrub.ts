import type { Event } from "@sentry/nextjs";

// The payment page (/p/[username]/[token]) and certificate verify page
// (/verify/[token]) embed a secret, capability-bearing token directly in the
// URL — possessing it is enough to view a freelancer's bank details or a
// certificate. Sentry's default instrumentation captures full request URLs,
// breadcrumb URLs, and transaction names, which would otherwise copy that
// token into Sentry's own storage. Redact it before the event leaves the app.
//
// Note: these regexes use the /g flag, so a fresh instance is created on every
// call rather than reused as a module-level const — a shared global regex's
// `lastIndex` persists across calls (via .test()/.exec()) and can cause silent
// false negatives on a later, unrelated event.
function redact(value: string): string {
  return value
    .replace(/(\/p\/[^/\s"]+\/)[a-f0-9]{16,64}/gi, "$1[redacted]")
    .replace(/(\/verify\/)[a-f0-9]{16,64}/gi, "$1[redacted]");
}

// Walks the whole event as JSON and redacts any occurrence of the token
// patterns, wherever Sentry put them (request.url, breadcrumbs, transaction
// name, span data, etc.) — simpler and more complete than enumerating every
// field Sentry might populate.
export function scrubSensitiveUrls<T extends Event>(event: T): T {
  try {
    return JSON.parse(redact(JSON.stringify(event)));
  } catch {
    return event;
  }
}
