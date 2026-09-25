import "server-only";

import { createClient } from "@/lib/supabase/server";

// Companies and skills for the job form's pickers.
export async function getJobFormOptions() {
  const supabase = await createClient();
  const [{ data: companies }, { data: skills }] = await Promise.all([
    supabase.from("companies").select("id, name").order("name"),
    supabase.from("skills").select("id, name").order("name"),
  ]);
  return { companies: companies ?? [], skills: skills ?? [] };
}
