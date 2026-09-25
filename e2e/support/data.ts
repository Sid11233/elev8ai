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

// Deletes a company and all of its jobs (jobs block company deletes).
export async function deleteCompanyByName(name: string) {
  const db = adminDb();
  const { data: companies } = await db.from("companies").select("id").eq("name", name);
  for (const c of companies ?? []) {
    await db.from("jobs").delete().eq("company_id", c.id);
    await db.from("companies").delete().eq("id", c.id);
  }
}
