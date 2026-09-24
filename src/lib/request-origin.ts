import "server-only";

// Public origin of the current request (e.g. https://elev8ai.com), used to build
// auth redirect URLs. Honours proxy headers so it works on Vercel and in
// Codespaces, where the dev server sees localhost but the browser does not.
export function getRequestOrigin(headers: Headers) {
  const host = headers.get("x-forwarded-host") ?? headers.get("host");
  if (!host) return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const proto =
    headers.get("x-forwarded-proto")?.split(",")[0] ??
    (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
