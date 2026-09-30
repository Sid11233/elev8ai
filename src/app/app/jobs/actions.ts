"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { track } from "@/lib/analytics";
import { requireOnboardedProfile } from "@/lib/auth";
import { notifyNewApplication } from "@/lib/notify-events";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/lib/validation/form-state";

export type ApplyField = "pitch" | "links" | "files";

const applySchema = z.object({
  pitch: z.string().trim().max(1000, "Keep your pitch under 1000 characters"),
  // One URL per line.
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
  // JSON array of storage paths the browser already uploaded.
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

export async function applyToJob(
  jobId: string,
  _prev: FormState<ApplyField>,
  formData: FormData,
): Promise<FormState<ApplyField>> {
  const profile = await requireOnboardedProfile();
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
  // apply_to_job enforces every rule (open, deadline, spots, badge, duplicates)
  // and returns the application id, with a message fit to show the user.
  const { data: applicationId, error } = await supabase.rpc("apply_to_job", {
    p_job_id: jobId,
    p_pitch: parsed.data.pitch,
    p_links: parsed.data.links,
    p_file_paths: parsed.data.file_paths,
  });
  if (error) return { message: error.message, values: { pitch: raw } };

  if (applicationId) {
    track("job_applied", profile.user_id, { job_id: jobId });
    await notifyNewApplication(applicationId);
  }

  revalidatePath(`/app/jobs/${jobId}`);
  revalidatePath("/app/my-jobs");
  return {};
}

export async function withdrawApplication(applicationId: string, jobId: string) {
  await requireOnboardedProfile();
  const supabase = await createClient();
  await supabase.rpc("withdraw_application", { p_application_id: applicationId });
  revalidatePath(`/app/jobs/${jobId}`);
  revalidatePath("/app/my-jobs");
}
