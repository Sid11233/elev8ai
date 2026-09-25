import type { Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// Test helpers that talk to the dev Supabase project with the service role key.
// Every user created here is deleted by deleteTestUser() in the test's cleanup.

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("E2E tests need Supabase keys in .env.local");
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function createTestUser(opts: { admin?: boolean; onboarded?: boolean } = {}) {
  const admin = adminClient();
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const email = `e2e-${suffix}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true });
  if (error) throw error;
  const id = data.user.id;

  if (opts.onboarded || opts.admin) {
    const { error: e } = await admin
      .from("profiles")
      .update({
        full_name: "E2E Tester",
        username: `e2e_${suffix}`.slice(0, 20),
        date_of_birth: "2000-01-01",
        country: "Mauritius",
        onboarded: true,
        role: opts.admin ? "admin" : "talent",
      })
      .eq("user_id", id);
    if (e) throw e;
  }

  return { id, email };
}

export async function deleteTestUser(id: string) {
  const admin = adminClient();
  const { data: files } = await admin.storage.from("avatars").list(id);
  if (files?.length) {
    await admin.storage.from("avatars").remove(files.map((f) => `${id}/${f.name}`));
  }
  // Submission files live in <user>/<application>/<file>.
  const { data: folders } = await admin.storage.from("submissions").list(id);
  for (const folder of folders ?? []) {
    const { data: inner } = await admin.storage.from("submissions").list(`${id}/${folder.name}`);
    if (inner?.length) {
      await admin.storage
        .from("submissions")
        .remove(inner.map((f) => `${id}/${folder.name}/${f.name}`));
    }
  }
  // Payouts block user deletion; tests clean up their own companies first,
  // this catches anything left over.
  await admin.from("payouts").delete().eq("user_id", id);
  await admin.from("submissions").delete().eq("user_id", id);
  await admin.from("applications").delete().eq("user_id", id);
  await admin.auth.admin.deleteUser(id);
}

export async function avatarUrlOf(id: string) {
  const { data } = await adminClient()
    .from("profiles")
    .select("avatar_url")
    .eq("user_id", id)
    .single();
  return data?.avatar_url ?? null;
}

// Logs in the way a magic link does, without needing a real inbox.
export async function logIn(page: Page, email: string, next?: string) {
  const { data, error } = await adminClient().auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (error) throw error;
  const params = new URLSearchParams({
    token_hash: data.properties.hashed_token,
    type: "magiclink",
  });
  if (next) params.set("next", next);
  await page.goto(`/auth/callback?${params}`);
}
