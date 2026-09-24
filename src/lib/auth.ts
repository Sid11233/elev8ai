import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

// Signed-in user's id and email, or null. Cached per request.
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims.sub) return null;
  return { id: data.claims.sub, email: data.claims.email as string | undefined };
});

export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").eq("user_id", user.id).single();
  return data;
});

// Where a signed-in user belongs by default.
export function homePathFor(profile: Pick<Profile, "onboarded" | "role">) {
  if (!profile.onboarded) return "/onboarding";
  return profile.role === "admin" ? "/admin" : "/app/jobs";
}

// Only allow same-site relative paths, so ?next= can't redirect off-site.
export function safeNextPath(next: string | null | undefined) {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return null;
  }
  return next;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireOnboardedProfile() {
  await requireUser();
  const profile = await getCurrentProfile();
  if (!profile || !profile.onboarded) redirect("/onboarding");
  return profile;
}

export async function requireAdmin() {
  const profile = await requireOnboardedProfile();
  if (profile.role !== "admin") redirect("/app/jobs");
  return profile;
}
