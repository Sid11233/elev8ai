"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireOnboardedProfile } from "@/lib/auth";
import { notifyNewCoursePurchase } from "@/lib/notify-events";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/lib/validation/form-state";

const schema = z.object({
  proof_path: z.string().max(500).optional(),
  reference: z.string().trim().max(200).optional(),
  note: z.string().trim().max(1000).optional(),
});

export type PurchaseField = "proof" | "reference" | "note";

// Talent submits proof of payment for a course. request_course_purchase checks
// access, one-pending, and that the proof file belongs to them.
export async function requestCoursePurchase(
  courseId: string,
  slug: string,
  _prev: FormState<PurchaseField>,
  formData: FormData,
): Promise<FormState<PurchaseField>> {
  await requireOnboardedProfile();
  const parsed = schema.safeParse({
    proof_path: (formData.get("proof_path") as string) || undefined,
    reference: (formData.get("reference") as string) || undefined,
    note: (formData.get("note") as string) || undefined,
  });
  if (!parsed.success) return { message: "Something was wrong with your submission." };
  if (!parsed.data.proof_path && !parsed.data.reference) {
    return { fieldErrors: { proof: "Upload a screenshot of your payment, or add a reference." } };
  }

  const supabase = await createClient();
  const { data: id, error } = await supabase.rpc("request_course_purchase", {
    p_course_id: courseId,
    p_proof_path: parsed.data.proof_path ?? "",
    p_reference: parsed.data.reference ?? undefined,
    p_note: parsed.data.note ?? undefined,
  });
  if (error) return { message: error.message };

  if (id) await notifyNewCoursePurchase(courseId);
  revalidatePath(`/app/learn/${slug}`);
  return {};
}
