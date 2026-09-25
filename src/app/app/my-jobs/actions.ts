"use server";

import { revalidatePath } from "next/cache";

import { requireOnboardedProfile } from "@/lib/auth";
import { notifyNewSubmission } from "@/lib/notify-events";
import { createClient } from "@/lib/supabase/server";
import { type FormState, fieldErrorsOf, textValues } from "@/lib/validation/form-state";
import { type SubmissionField, submissionSchema } from "@/lib/validation/submission";

export async function submitWork(
  applicationId: string,
  pay: { perUnit: boolean },
  _prev: FormState<SubmissionField>,
  formData: FormData,
): Promise<FormState<SubmissionField>> {
  await requireOnboardedProfile();
  const values = textValues(formData, ["links", "file_paths", "notes", "units"] as const);
  const parsed = submissionSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), values };

  let units: number | null = null;
  if (pay.perUnit) {
    if (!/^\d+$/.test(parsed.data.units) || Number(parsed.data.units) < 1) {
      return { fieldErrors: { units: "Enter how many you completed (a whole number)" }, values };
    }
    units = Number(parsed.data.units);
  }

  const supabase = await createClient();
  // submit_work checks ownership, acceptance, file paths and duplicates.
  const { error } = await supabase.rpc("submit_work", {
    p_application_id: applicationId,
    p_notes: parsed.data.notes,
    p_links: parsed.data.links,
    p_file_paths: parsed.data.file_paths,
    p_units_claimed: units ?? undefined,
  });
  if (error) return { message: error.message, values };

  await notifyNewSubmission(applicationId);

  revalidatePath(`/app/my-jobs/${applicationId}`);
  revalidatePath("/app/my-jobs");
  return {};
}
