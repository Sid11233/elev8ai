import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import type { Database } from "./database.types";
import { getSupabasePublicEnv } from "./env";

// Supabase client for Server Components, Server Actions and Route Handlers.
// Runs as the signed-in user (from cookies), so RLS applies.
export async function createClient() {
  const { url, anonKey } = getSupabasePublicEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // Safe to ignore: the proxy refreshes the session on every request.
        }
      },
    },
  });
}
