import "server-only";

import { createClient } from "@/lib/supabase/server";

// category -> pre-fill checklist text, used to seed the proof instructions
// field when a company/admin picks a category.
export async function getProofTemplates(): Promise<Record<string, string>> {
  const supabase = await createClient();
  const { data } = await supabase.from("proof_templates").select("category, checklist_text");
  return Object.fromEntries((data ?? []).map((t) => [t.category, t.checklist_text]));
}
