"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/lib/validation/form-state";

const reviewSchema = z
  .object({
    decision: z.enum(["approved", "changes_requested", "rejected"]),
    note: z.string().trim().max(2000, "Keep the note under 2000 characters"),
    units: z.string().trim(),
  })
  .refine((r) => r.decision === "approved" || r.note.length > 0, {
    path: ["note"],
    message: "Add a note so the talent knows what to change or why",
  })
  .refine((r) => r.units === "" || (/^\d+$/.test(r.units) && Number(r.units) >= 1), {
    path: ["units"],
    message: "Approved units must be a whole number of at least 1",
  });

export async function reviewSubmission(
  submissionId: string,
  _prev: FormState<"note" | "units">,
  formData: FormData,
): Promise<FormState<"note" | "units">> {
  await requireAdmin();
  const values = {
    decision: String(formData.get("decision") ?? ""),
    note: String(formData.get("note") ?? ""),
    units: String(formData.get("units") ?? ""),
  };
  const parsed = reviewSchema.safeParse(values);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue.path[0] === "units" ? "units" : "note";
    return { fieldErrors: { [field]: issue.message }, values };
  }

  const supabase = await createClient();
  // review_submission creates the owed payout in the same transaction on approval.
  const { error } = await supabase.rpc("review_submission", {
    p_submission_id: submissionId,
    p_decision: parsed.data.decision,
    p_note: parsed.data.note,
    p_units_approved: parsed.data.units ? Number(parsed.data.units) : undefined,
  });
  if (error) return { message: error.message, values };

  revalidatePath("/admin/submissions");
  revalidatePath("/admin/payouts");
  return {};
}
