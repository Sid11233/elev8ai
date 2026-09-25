import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

// Public marketing data for the landing page. Uses the service role because the
// page is viewed logged-out; only public-safe fields are selected.
export async function getLandingData() {
  const supabase = createAdminClient();
  const [{ data: companies }, { data: courses }, { count: openJobs }] = await Promise.all([
    supabase.from("companies").select("name, description, logo_url").order("name"),
    supabase
      .from("courses")
      .select("slug, title, description, price_cents, skill:skills(name)")
      .eq("published", true)
      .order("price_cents")
      .limit(4),
    supabase.from("jobs").select("id", { count: "exact", head: true }).eq("status", "open"),
  ]);
  return { companies: companies ?? [], courses: courses ?? [], openJobs: openJobs ?? 0 };
}
