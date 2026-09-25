"use server";

import { revalidatePath } from "next/cache";

import { requireOnboardedProfile } from "@/lib/auth";
import { notifyNewAssignment } from "@/lib/notify-events";
import { createClient } from "@/lib/supabase/server";
import { type FormState, fieldErrorsOf, textValues } from "@/lib/validation/form-state";
import { submissionSchema, type SubmissionField } from "@/lib/validation/submission";

// Submit (or resubmit) a course assignment. submit_assignment enforces access,
// one-pending, and file ownership.
export async function submitAssignment(
  courseId: string,
  slug: string,
  _prev: FormState<SubmissionField>,
  formData: FormData,
): Promise<FormState<SubmissionField>> {
  await requireOnboardedProfile();
  const values = textValues(formData, ["links", "file_paths", "notes", "units"] as const);
  const parsed = submissionSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), values };

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_assignment", {
    p_course_id: courseId,
    p_notes: parsed.data.notes,
    p_links: parsed.data.links,
    p_file_paths: parsed.data.file_paths,
  });
  if (error) return { message: error.message, values };

  await notifyNewAssignment(courseId);
  revalidatePath(`/app/learn/${slug}`);
  return {};
}
