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
    supabase.from("user_skills").select("skill_id, created_at").eq("user_id", userId),
    supabase.from("applications").select("job_id, status").eq("user_id", userId),
  ]);

  const skillIds = new Set((badges ?? []).map((b) => b.skill_id));
  // Skills earned within the last 7 days -> "Newly unlocked" tag.
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recentSkills = new Set(
    (badges ?? [])
      .filter((b) => new Date(b.created_at).getTime() >= weekAgo)
      .map((b) => b.skill_id),
  );
  const applied = new Map((applications ?? []).map((a) => [a.job_id, a.status]));
  const courseBySkill = await getCourseSlugsForSkills(
    (jobs ?? []).map((j) => j.required_skill_id).filter((s): s is string => !!s),
  );
  return {
    jobs: (jobs ?? []).map((job) => ({
      ...job,
      locked: !!job.required_skill_id && !skillIds.has(job.required_skill_id),
      applicationStatus: applied.get(job.id) ?? null,
      unlockCourseSlug: job.required_skill_id
        ? (courseBySkill.get(job.required_skill_id) ?? null)
        : null,
      newlyUnlocked: !!job.required_skill_id && recentSkills.has(job.required_skill_id),
    })),
  };
}

// Published course slug that awards each of the given skills, if any.
async function getCourseSlugsForSkills(skillIds: string[]) {
  const map = new Map<string, string>();
  const unique = [...new Set(skillIds)];
  if (!unique.length) return map;
  const supabase = await createClient();
  const { data } = await supabase
    .from("courses")
    .select("slug, skill_id")
    .eq("published", true)
    .in("skill_id", unique);
  for (const c of data ?? []) if (c.skill_id) map.set(c.skill_id, c.slug);
  return map;
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
  const unlockCourseSlug = job.required_skill_id
    ? ((await getCourseSlugsForSkills([job.required_skill_id])).get(job.required_skill_id) ?? null)
    : null;
  return { ...job, locked, application, acceptingApplications, unlockCourseSlug };
}
