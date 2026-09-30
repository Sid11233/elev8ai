"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/lib/validation/form-state";

const schema = z.object({
  stars: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? Number(v) : null))
    .refine((v) => v === null || (Number.isInteger(v) && v >= 1 && v <= 5), "Pick 1 to 5 stars"),
  comment: z.string().trim().max(2000, "Keep feedback under 2000 characters"),
});

export type ReviewField = "stars" | "comment";

// Submit feedback/rating for a paid job. submit_job_review derives the role
// (freelancer vs provider) from the caller and enforces one review per party.
export async function submitJobReview(
  applicationId: string,
  revalidate: string,
  _prev: FormState<ReviewField>,
  formData: FormData,
): Promise<FormState<ReviewField>> {
  await requireUser();
  const parsed = schema.safeParse({
    stars: (formData.get("stars") as string) || undefined,
    comment: String(formData.get("comment") ?? ""),
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { fieldErrors: { [issue.path[0] as ReviewField]: issue.message } };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_job_review", {
    p_application_id: applicationId,
    p_stars: parsed.data.stars ?? undefined,
    p_comment: parsed.data.comment,
  });
  if (error) return { message: error.message };

  revalidatePath(revalidate);
  return { message: "ok" };
}
