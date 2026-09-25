import "server-only";

import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Open jobs a talent user can see, with company and required skill, plus the
// ids of the skills (badges) the user holds.
export async function getOpenJobsForTalent() {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const now = new Date().toISOString();

  const [{ data: jobs }, { data: badges }] = await Promise.all([
    supabase
      .from("jobs")
      .select(
        "*, company:companies(id, name, logo_url, description, website), skill:skills(id, slug, name)",
      )
      .eq("status", "open")
      .or(`deadline.is.null,deadline.gt.${now}`)
      .order("published_at", { ascending: false }),
    supabase
      .from("user_skills")
      .select("skill_id")
      .eq("user_id", user?.id ?? ""),
  ]);

  const skillIds = new Set((badges ?? []).map((b) => b.skill_id));
  return {
    jobs: (jobs ?? []).map((job) => ({
      ...job,
      locked: !!job.required_skill_id && !skillIds.has(job.required_skill_id),
    })),
  };
}

export type BoardJob = Awaited<ReturnType<typeof getOpenJobsForTalent>>["jobs"][number];

export async function getOpenJobForTalent(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const user = await getCurrentUser();
  const supabase = await createClient();

  const { data: job } = await supabase
    .from("jobs")
    .select(
      "*, company:companies(id, name, logo_url, description, website), skill:skills(id, slug, name)",
    )
    .eq("id", id)
    .eq("status", "open")
    .maybeSingle();
  if (!job) return null;

  let locked = false;
  if (job.required_skill_id) {
    const { data: badge } = await supabase
      .from("user_skills")
      .select("id")
      .eq("user_id", user?.id ?? "")
      .eq("skill_id", job.required_skill_id)
      .maybeSingle();
    locked = !badge;
  }
  return { ...job, locked };
}
