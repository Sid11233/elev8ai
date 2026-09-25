"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth";
import { notifyApplicationDecision } from "@/lib/notify-events";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/lib/validation/form-state";

const decisionSchema = z.object({
  decision: z.enum(["accept", "reject"]),
  note: z.string().trim().max(1000, "Keep the note under 1000 characters"),
});

export async function decideApplication(
  applicationId: string,
  _prev: FormState<"note">,
  formData: FormData,
): Promise<FormState<"note">> {
  await requireAdmin();
  const parsed = decisionSchema.safeParse({
    decision: formData.get("decision"),
    note: String(formData.get("note") ?? ""),
  });
  if (!parsed.success) return { message: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.rpc("decide_application", {
    p_application_id: applicationId,
    p_accept: parsed.data.decision === "accept",
    p_note: parsed.data.note,
  });
  if (error) return { message: error.message };

  await notifyApplicationDecision(applicationId, parsed.data.decision === "accept");

  revalidatePath("/admin/applications");
  return {};
}
