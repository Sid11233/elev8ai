"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireCompany } from "@/lib/auth";
import { notifySubmissionReviewed } from "@/lib/notify-events";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/lib/validation/form-state";

const schema = z
  .object({
    decision: z.enum(["approved", "changes_requested", "rejected"]),
    note: z.string().trim().max(2000),
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

// review_submission enforces that the caller manages the job (their company).
export async function reviewSubmission(
  submissionId: string,
  _prev: FormState<"note" | "units">,
  formData: FormData,
): Promise<FormState<"note" | "units">> {
  const { profile } = await requireCompany();
  const parsed = schema.safeParse({
    decision: formData.get("decision"),
    note: String(formData.get("note") ?? ""),
    units: String(formData.get("units") ?? ""),
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { fieldErrors: { [issue.path[0] === "units" ? "units" : "note"]: issue.message } };
  }
  if (profile.suspended && parsed.data.decision === "approved") {
    return { message: "Your account is under review and can't approve work right now." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("review_submission", {
    p_submission_id: submissionId,
    p_decision: parsed.data.decision,
    p_note: parsed.data.note,
    p_units_approved: parsed.data.units ? Number(parsed.data.units) : undefined,
  });
  if (error) return { message: error.message };

  await notifySubmissionReviewed(submissionId, parsed.data.decision);
  revalidatePath("/company/submissions");
  revalidatePath("/company/payouts");
  return {};
}
