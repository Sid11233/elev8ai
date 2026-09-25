"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth";
import { notifyAssignmentGraded, notifyBadgeAwarded } from "@/lib/notify-events";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/lib/validation/form-state";

const gradeSchema = z
  .object({
    decision: z.enum(["pass", "fail"]),
    feedback: z.string().trim().max(2000, "Keep feedback under 2000 characters"),
  })
  .refine((g) => g.decision === "pass" || g.feedback.length > 0, {
    path: ["feedback"],
    message: "Add feedback so the talent knows what to improve",
  });

export async function gradeAssignment(
  assignmentId: string,
  userId: string,
  _prev: FormState<"feedback">,
  formData: FormData,
): Promise<FormState<"feedback">> {
  await requireAdmin();
  const parsed = gradeSchema.safeParse({
    decision: formData.get("decision"),
    feedback: String(formData.get("feedback") ?? ""),
  });
  if (!parsed.success) return { fieldErrors: { feedback: parsed.error.issues[0].message } };

  const passed = parsed.data.decision === "pass";
  const supabase = await createClient();
  const { data: skillId, error } = await supabase.rpc("grade_assignment", {
    p_assignment_id: assignmentId,
    p_pass: passed,
    p_feedback: parsed.data.feedback,
  });
  if (error) return { message: error.message };

  await notifyAssignmentGraded(assignmentId, passed);
  if (passed && skillId) await notifyBadgeAwarded(userId, skillId);

  revalidatePath("/admin/grading");
  return {};
}
