import { createBrowserClient } from "@supabase/ssr";

import { getSupabasePublicEnv } from "./env";

// Supabase client for Client Components. Runs as the signed-in user, so RLS applies.
export function createClient() {
  const { url, anonKey } = getSupabasePublicEnv();
  return createBrowserClient(url, anonKey);
}
