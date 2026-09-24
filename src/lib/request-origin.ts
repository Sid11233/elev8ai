// Origin the browser is actually on (e.g. https://elev8ai.com), used to build
// auth redirect URLs that Supabase sends the user back to. The Origin header
// wins because behind port forwarding (Codespaces) the forwarded host can differ
// from the address in the user's address bar, and auth cookies live on the latter.
export function getRequestOrigin(headers: Headers) {
  const origin = headers.get("origin");
  if (origin && origin !== "null") return origin;

  const host = headers.get("x-forwarded-host") ?? headers.get("host");
  if (!host) return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const proto =
    headers.get("x-forwarded-proto")?.split(",")[0] ??
    (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
