import "server-only";

import { getCurrentUser } from "@/lib/auth";
import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

export type Application = Database["public"]["Tables"]["applications"]["Row"];
export type Submission = Database["public"]["Tables"]["submissions"]["Row"];
export type Payout = Database["public"]["Tables"]["payouts"]["Row"];

// Where an application is in the job flow, from the talent's point of view.
export type JobStage = "applied" | "in_progress" | "submitted" | "completed";

export const STAGE_LABELS: Record<JobStage, string> = {
  applied: "Applied",
  in_progress: "In progress",
  submitted: "Submitted",
  completed: "Completed",
};

export function latestSubmission<T extends Pick<Submission, "created_at">>(submissions: T[]) {
  return [...submissions].sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;
}

export function stageOf(
  application: Pick<Application, "status">,
  latest: Pick<Submission, "status"> | null,
): JobStage {
  if (application.status !== "accepted") return "applied";
  if (!latest || latest.status === "changes_requested") return "in_progress";
  if (latest.status === "submitted") return "submitted";
  return "completed";
}

const MY_JOB_SELECT =
  "*, job:jobs(id, title, category, pay_cents, pay_type, unit_label, max_units, deadline, status, proof_instructions, company:companies(name, logo_url)), submissions(*, payout:payouts(*))";

export async function getMyApplications() {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from("applications")
    .select(MY_JOB_SELECT)
    .eq("user_id", user?.id ?? "")
    .order("updated_at", { ascending: false });

  return (data ?? []).map((app) => {
    const latest = latestSubmission(app.submissions);
    return { ...app, latest, stage: stageOf(app, latest) };
  });
}

export type MyApplication = Awaited<ReturnType<typeof getMyApplications>>[number];

export async function getMyApplication(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data: app } = await supabase
    .from("applications")
    .select(MY_JOB_SELECT)
    .eq("id", id)
    .eq("user_id", user?.id ?? "")
    .maybeSingle();
  if (!app) return null;
  const latest = latestSubmission(app.submissions);
  return { ...app, latest, stage: stageOf(app, latest) };
}
