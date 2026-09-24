import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "./database.types";
import { getSupabasePublicEnv } from "./env";

// Supabase client for Client Components. Runs as the signed-in user, so RLS applies.
export function createClient() {
  const { url, anonKey } = getSupabasePublicEnv();
  return createBrowserClient<Database>(url, anonKey);
}
