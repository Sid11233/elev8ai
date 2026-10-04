"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireCompany } from "@/lib/auth";
import { notifyApplicationDecision } from "@/lib/notify-events";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/lib/validation/form-state";

const schema = z.object({
  decision: z.enum(["accept", "reject"]),
  note: z.string().trim().max(1000, "Keep the note under 1000 characters"),
});

// decide_application enforces that the caller manages the job (their company).
export async function decideApplication(
  applicationId: string,
  _prev: FormState<"note">,
  formData: FormData,
): Promise<FormState<"note">> {
  const { profile } = await requireCompany();
  const parsed = schema.safeParse({
    decision: formData.get("decision"),
    note: String(formData.get("note") ?? ""),
  });
  if (!parsed.success) return { message: parsed.error.issues[0].message };
  if (profile.suspended && parsed.data.decision === "accept") {
    return { message: "Your account is under review and can't accept applications right now." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("decide_application", {
    p_application_id: applicationId,
    p_accept: parsed.data.decision === "accept",
    p_note: parsed.data.note,
  });
  if (error) return { message: error.message };

  await notifyApplicationDecision(applicationId, parsed.data.decision === "accept");
  revalidatePath("/company/applications");
  return {};
}
