"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireCompany } from "@/lib/auth";
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

// A company posts/edits its own job. company_id is forced to the caller's
// company; RLS also blocks writing to any other company's jobs.
export async function saveCompanyJob(
  jobId: string | null,
  _prev: FormState<JobField>,
  formData: FormData,
): Promise<FormState<JobField>> {
  const { company } = await requireCompany();
  const values = textValues(formData, FIELDS);
  const parsed = jobSchema.safeParse({ ...values, company_id: company.id });
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), values };

  const { intent, values: job } = parsed.data;
  const status: JobStatus | undefined =
    intent === "publish" ? "open" : intent === "draft" ? "draft" : undefined;

  const supabase = await createClient();
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
      .update({ ...job, company_id: company.id, ...(status ? { status } : {}) })
      .eq("id", jobId);
    if (error) return { message: "Couldn't save the job. Please try again.", values };
  } else {
    firstPublish = status === "open";
    const { data: created, error } = await supabase
      .from("jobs")
      .insert({ ...job, company_id: company.id, status: status ?? "draft" })
      .select("id")
      .single();
    if (error) return { message: "Couldn't save the job. Please try again.", values };
    savedId = created.id;
  }

  if (firstPublish && savedId) await notifyNewJob(savedId);
  redirect("/company/jobs");
}

export async function setCompanyJobStatus(jobId: string, status: string) {
  await requireCompany();
  if (!isJobStatus(status)) return;
  const supabase = await createClient();
  await supabase.from("jobs").update({ status }).eq("id", jobId); // RLS scopes to own jobs
  revalidatePath("/company/jobs");
}

export async function duplicateCompanyJob(jobId: string) {
  const { company } = await requireCompany();
  const supabase = await createClient();
  const { data: job } = await supabase.from("jobs").select("*").eq("id", jobId).single();
  if (!job || job.company_id !== company.id) redirect("/company/jobs");

  const { data: created } = await supabase
    .from("jobs")
    .insert({
      company_id: company.id,
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

  redirect(created ? `/company/jobs/${created.id}` : "/company/jobs");
}
