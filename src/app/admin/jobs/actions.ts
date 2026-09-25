"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/auth";
import { type JobStatus, isJobStatus } from "@/lib/jobs";
import { notifyNewJob } from "@/lib/notify-events";
import { createClient } from "@/lib/supabase/server";
import { type FormState, fieldErrorsOf, textValues } from "@/lib/validation/form-state";
import { type JobField, jobSchema } from "@/lib/validation/job";

const FIELDS = [
  "company_id",
  "title",
  "description",
  "category",
  "pay",
  "pay_type",
  "unit_label",
  "max_units",
  "slots",
  "required_skill_id",
  "deadline",
  "proof_instructions",
  "intent",
] as const;

// Create (jobId null) or update a job. intent: draft | publish | save (keep status).
export async function saveJob(
  jobId: string | null,
  _prev: FormState<JobField>,
  formData: FormData,
): Promise<FormState<JobField>> {
  await requireAdmin();

  const values = textValues(formData, FIELDS);
  const parsed = jobSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), values };

  const { intent, values: job } = parsed.data;
  const status: JobStatus | undefined =
    intent === "publish" ? "open" : intent === "draft" ? "draft" : undefined;

  const supabase = await createClient();

  // Notify interested talent only the first time a job goes live.
  let firstPublish = false;
  let savedId = jobId;

  if (jobId) {
    if (status === "open") {
      const { data: existing } = await supabase
        .from("jobs")
        .select("published_at")
        .eq("id", jobId)
        .single();
      firstPublish = !existing?.published_at;
    }
    const { error } = await supabase
      .from("jobs")
      .update({ ...job, ...(status ? { status } : {}) })
      .eq("id", jobId);
    if (error) return { message: "Couldn't save the job. Please try again.", values };
  } else {
    firstPublish = status === "open";
    const { data: created, error } = await supabase
      .from("jobs")
      .insert({ ...job, status: status ?? "draft" })
      .select("id")
      .single();
    if (error) return { message: "Couldn't save the job. Please try again.", values };
    savedId = created.id;
  }

  if (firstPublish && savedId) await notifyNewJob(savedId);

  redirect("/admin/jobs");
}

export async function setJobStatus(jobId: string, status: string) {
  await requireAdmin();
  if (!isJobStatus(status)) return;
  const supabase = await createClient();
  await supabase.from("jobs").update({ status }).eq("id", jobId);
  revalidatePath("/admin/jobs");
}

// Copies a job as a new draft and opens it for editing.
export async function duplicateJob(jobId: string) {
  await requireAdmin();
  const supabase = await createClient();
  const { data: job } = await supabase.from("jobs").select("*").eq("id", jobId).single();
  if (!job) redirect("/admin/jobs");

  const { data: created } = await supabase
    .from("jobs")
    .insert({
      company_id: job.company_id,
      title: `${job.title} (copy)`.slice(0, 120),
      description: job.description,
      category: job.category,
      pay_cents: job.pay_cents,
      pay_type: job.pay_type,
      unit_label: job.unit_label,
      max_units: job.max_units,
      slots: job.slots,
      required_skill_id: job.required_skill_id,
      deadline: job.deadline,
      proof_instructions: job.proof_instructions,
      status: "draft",
    })
    .select("id")
    .single();

  redirect(created ? `/admin/jobs/${created.id}` : "/admin/jobs");
}
