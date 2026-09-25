import { createClient } from "@supabase/supabase-js";

// Service-role helpers for creating and cleaning up test companies and jobs.
export function adminDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("E2E tests need Supabase keys in .env.local");
  return createClient(url, key, { auth: { persistSession: false } });
}

export function uniqueSuffix() {
  return `${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

export async function createTestCompany(name = `E2E Co ${uniqueSuffix()}`) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const { data, error } = await adminDb()
    .from("companies")
    .insert({ name, slug })
    .select("id, name, slug")
    .single();
  if (error) throw error;
  return data;
}

// Deletes a company with its jobs and everything hanging off them
// (payouts -> submissions -> applications -> jobs block each other's deletes).
export async function deleteCompanyByName(name: string) {
  const db = adminDb();
  const { data: companies } = await db.from("companies").select("id").eq("name", name);
  for (const c of companies ?? []) {
    const { data: jobs } = await db.from("jobs").select("id").eq("company_id", c.id);
    const jobIds = (jobs ?? []).map((j) => j.id);
    const { data: apps } = await db.from("applications").select("id").in("job_id", jobIds);
    const appIds = (apps ?? []).map((a) => a.id);
    const { data: subs } = await db.from("submissions").select("id").in("application_id", appIds);
    const subIds = (subs ?? []).map((s) => s.id);
    await db.from("payouts").delete().in("submission_id", subIds);
    await db.from("submissions").delete().in("id", subIds);
    await db.from("applications").delete().in("id", appIds);
    await db.from("jobs").delete().eq("company_id", c.id);
    await db.from("companies").delete().eq("id", c.id);
  }
}
