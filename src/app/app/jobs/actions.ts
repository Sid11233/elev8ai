"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireOnboardedProfile } from "@/lib/auth";
import { notifyNewApplication } from "@/lib/notify-events";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/lib/validation/form-state";

const pitchSchema = z.string().trim().max(1000, "Keep your pitch under 1000 characters");

export async function applyToJob(
  jobId: string,
  _prev: FormState<"pitch">,
  formData: FormData,
): Promise<FormState<"pitch">> {
  await requireOnboardedProfile();
  const raw = String(formData.get("pitch") ?? "");
  const pitch = pitchSchema.safeParse(raw);
  if (!pitch.success) {
    return { fieldErrors: { pitch: pitch.error.issues[0].message }, values: { pitch: raw } };
  }

  const supabase = await createClient();
  // apply_to_job enforces every rule (open, deadline, spots, badge, duplicates)
  // and returns the application id, with a message fit to show the user.
  const { data: applicationId, error } = await supabase.rpc("apply_to_job", {
    p_job_id: jobId,
    p_pitch: pitch.data,
  });
  if (error) return { message: error.message, values: { pitch: raw } };

  if (applicationId) await notifyNewApplication(applicationId);

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
