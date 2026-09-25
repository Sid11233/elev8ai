import "server-only";

import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const JOB_SELECT =
  "*, company:companies(id, name, logo_url, description, website), skill:skills(id, slug, name)";

export function spotsLeft(job: { slots: number; spots_taken: number }) {
  return Math.max(0, job.slots - job.spots_taken);
}

// Open jobs a talent user can see, each marked locked (missing badge) and
// with the user's application status if they applied.
export async function getOpenJobsForTalent() {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const now = new Date().toISOString();
  const userId = user?.id ?? "";

  const [{ data: jobs }, { data: badges }, { data: applications }] = await Promise.all([
    supabase
      .from("jobs")
      .select(JOB_SELECT)
      .eq("status", "open")
      .or(`deadline.is.null,deadline.gt.${now}`)
      .order("published_at", { ascending: false }),
    supabase.from("user_skills").select("skill_id").eq("user_id", userId),
    supabase.from("applications").select("job_id, status").eq("user_id", userId),
  ]);

  const skillIds = new Set((badges ?? []).map((b) => b.skill_id));
  const applied = new Map((applications ?? []).map((a) => [a.job_id, a.status]));
  return {
    jobs: (jobs ?? []).map((job) => ({
      ...job,
      locked: !!job.required_skill_id && !skillIds.has(job.required_skill_id),
      applicationStatus: applied.get(job.id) ?? null,
    })),
  };
}

export type BoardJob = Awaited<ReturnType<typeof getOpenJobsForTalent>>["jobs"][number];

// One job for its detail page: open jobs, or any job the user applied to.
export async function getJobForTalent(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const user = await getCurrentUser();
  const supabase = await createClient();
  const userId = user?.id ?? "";

  const [{ data: job }, { data: application }] = await Promise.all([
    supabase.from("jobs").select(JOB_SELECT).eq("id", id).maybeSingle(),
    supabase.from("applications").select("*").eq("job_id", id).eq("user_id", userId).maybeSingle(),
  ]);
  // Admins can read drafts through RLS; the talent page still only shows
  // open jobs and jobs the user applied to.
  if (!job || (job.status !== "open" && !application)) return null;

  let locked = false;
  if (job.required_skill_id) {
    const { data: badge } = await supabase
      .from("user_skills")
      .select("id")
      .eq("user_id", userId)
      .eq("skill_id", job.required_skill_id)
      .maybeSingle();
    locked = !badge;
  }

  const expired = !!job.deadline && new Date(job.deadline) < new Date();
  const acceptingApplications = job.status === "open" && !expired && spotsLeft(job) > 0;
  return { ...job, locked, application, acceptingApplications };
}
