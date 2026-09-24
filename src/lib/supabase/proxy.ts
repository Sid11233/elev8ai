import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getSupabasePublicEnv } from "./env";

// Refreshes the Supabase auth session on every request and writes the updated
// cookies onto the response. Route protection gets added here in Phase 1b.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Until Supabase is configured there is no session to refresh; let the
  // placeholder site load instead of failing every request.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return response;
  }

  const { url, anonKey } = getSupabasePublicEnv();

  const supabase = createServerClient(url, anonKey, {
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
  await supabase.auth.getClaims();

  return response;
}
