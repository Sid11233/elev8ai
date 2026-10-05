import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getRequestOrigin } from "@/lib/request-origin";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";

import { getSupabasePublicEnv } from "./env";

// Refreshes the Supabase auth session on every request and writes the updated
// cookies onto the response. Sends signed-out visitors of protected areas to /login.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Rate limit every mutating request (every Server Action is dispatched as a
  // POST to its page URL, so this one check covers all ~35 action files
  // without instrumenting each individually). /login gets a tighter bucket —
  // it's the magic-link/OAuth entry point, the single highest-value target
  // for brute-forcing or spamming. See src/lib/rate-limit.ts for the
  // in-memory-vs-Redis tradeoff.
  if (request.method === "POST") {
    const ip = clientIp(request.headers);
    const { pathname } = request.nextUrl;
    const isAuthEndpoint = pathname === "/login" || pathname === "/onboarding";
    const limit = checkRateLimit(
      `${ip}:${isAuthEndpoint ? "auth" : "mutate"}`,
      isAuthEndpoint ? 10 : 60,
      60_000,
    );
    if (!limit.ok) {
      return new NextResponse("Too many requests. Try again shortly.", {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSeconds) },
      });
    }
  }

  // Until Supabase is configured there is no session to refresh; let the
  // placeholder site load instead of failing every request.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return response;
  }

  const { url, anonKey } = getSupabasePublicEnv();

  const supabase = createServerClient(url, anonKey, {
    // Keep in sync with src/lib/supabase/server.ts and src/lib/supabase/client.ts.
    cookieOptions: {
      secure: process.env.NODE_ENV === "production",
    },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  // Do not put code between createServerClient and getClaims(): it validates
  // the JWT and triggers the refresh that keeps users signed in.
  const { data } = await supabase.auth.getClaims();
  const signedIn = !!data?.claims.sub;

  const { pathname, search } = request.nextUrl;

  // When a redirect URL isn't allow-listed, Supabase falls back to the Site URL
  // and appends the login code there. Finish the login instead of ignoring it.
  const params = request.nextUrl.searchParams;
  if (pathname === "/" && (params.has("code") || params.has("token_hash"))) {
    return NextResponse.redirect(
      new URL(`/auth/callback${search}`, getRequestOrigin(request.headers)),
    );
  }

  if (!signedIn && PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    // Proxy redirects must be absolute, so build them on the public host.
    const loginUrl = new URL("/login", getRequestOrigin(request.headers));
    loginUrl.searchParams.set("next", pathname + search);
    const redirect = NextResponse.redirect(loginUrl);
    // Keep any cookies Supabase just cleared or refreshed.
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }

  // Role and onboarding checks happen on the server in each area's layout.
  return response;
}

const PROTECTED_PREFIXES = ["/app", "/admin", "/company", "/onboarding"];
