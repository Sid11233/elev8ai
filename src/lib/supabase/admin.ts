import "server-only";

import { createClient } from "@supabase/supabase-js";

import type { Database } from "./database.types";
import { getSupabasePublicEnv } from "./env";

// Service-role client: BYPASSES RLS. Only for trusted server code such as
// webhooks. Never import this from a Client Component.
export function createAdminClient() {
  const { url } = getSupabasePublicEnv();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY in the server environment.");
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
