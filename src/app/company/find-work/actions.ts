"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { track } from "@/lib/analytics";
import { requireCompany } from "@/lib/auth";
import { notifyNewApplication } from "@/lib/notify-events";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/lib/validation/form-state";

import type { ApplyField } from "@/app/app/jobs/actions";

const applySchema = z.object({
  pitch: z.string().trim().max(1000, "Keep your pitch under 1000 characters"),
  links: z
    .string()
    .transform((v) =>
      v
        .split(/\s+/)
        .map((l) => l.trim())
        .filter(Boolean),
    )
    .pipe(
      z
        .array(z.url({ protocol: /^https?$/, message: "Links must start with https://" }))
        .max(10, "Up to 10 links"),
    ),
  file_paths: z
    .string()
    .transform((v, ctx) => {
      try {
        return v ? (JSON.parse(v) as unknown) : [];
      } catch {
        ctx.addIssue({ code: "custom", message: "Invalid file list" });
        return z.NEVER;
      }
    })
    .pipe(z.array(z.string().max(500)).max(10)),
});

// A company applies to another company's job. apply_to_job exempts companies
// from the skill badge and blocks applying to your own job.
export async function applyAsCompany(
  jobId: string,
  _prev: FormState<ApplyField>,
  formData: FormData,
): Promise<FormState<ApplyField>> {
  const { profile } = await requireCompany();
  const raw = String(formData.get("pitch") ?? "");
  const parsed = applySchema.safeParse({
    pitch: raw,
    links: String(formData.get("links") ?? ""),
    file_paths: String(formData.get("file_paths") ?? ""),
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field =
      issue.path[0] === "links" ? "links" : issue.path[0] === "file_paths" ? "files" : "pitch";
    return { fieldErrors: { [field]: issue.message }, values: { pitch: raw } };
  }

  const supabase = await createClient();
  const { data: applicationId, error } = await supabase.rpc("apply_to_job", {
    p_job_id: jobId,
    p_pitch: parsed.data.pitch,
    p_links: parsed.data.links,
    p_file_paths: parsed.data.file_paths,
  });
  if (error) return { message: error.message, values: { pitch: raw } };

  if (applicationId) {
    track("job_applied", profile.user_id, { job_id: jobId, kind: "company" });
    await notifyNewApplication(applicationId);
  }

  revalidatePath(`/company/find-work/${jobId}`);
  return {};
}
