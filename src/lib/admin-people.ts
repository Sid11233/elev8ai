import "server-only";

import type { Profile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type PersonSummary = Pick<
  Profile,
  "user_id" | "full_name" | "username" | "avatar_url" | "country"
> & {
  badges: string[];
};

// Profiles and badge names for a set of users, keyed by user id (admin only via RLS).
export async function getPeople(userIds: string[]): Promise<Map<string, PersonSummary>> {
  const ids = [...new Set(userIds)];
  if (!ids.length) return new Map();
  const supabase = await createClient();
  const [{ data: profiles }, { data: badges }] = await Promise.all([
    supabase
      .from("profiles")
      .select("user_id, full_name, username, avatar_url, country")
      .in("user_id", ids),
    supabase.from("user_skills").select("user_id, skill:skills(name)").in("user_id", ids),
  ]);

  const people = new Map<string, PersonSummary>();
  for (const p of profiles ?? []) people.set(p.user_id, { ...p, badges: [] });
  for (const b of badges ?? []) {
    if (b.skill) people.get(b.user_id)?.badges.push(b.skill.name);
  }
  return people;
}
