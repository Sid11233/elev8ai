"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { track } from "@/lib/analytics";
import { requireAdmin } from "@/lib/auth";
import { notifyCoursePurchaseReviewed } from "@/lib/notify-events";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/lib/validation/form-state";

const reviewSchema = z
  .object({
    decision: z.enum(["approve", "reject"]),
    note: z.string().trim().max(1000, "Keep the note under 1000 characters"),
  })
  .refine((r) => r.decision === "approve" || r.note.length > 0, {
    path: ["note"],
    message: "Add a note so the buyer knows why it was rejected",
  });

export async function reviewCoursePurchase(
  purchaseId: string,
  _prev: FormState<"note">,
  formData: FormData,
): Promise<FormState<"note">> {
  await requireAdmin();
  const parsed = reviewSchema.safeParse({
    decision: formData.get("decision"),
    note: String(formData.get("note") ?? ""),
  });
  if (!parsed.success) return { fieldErrors: { note: parsed.error.issues[0].message } };

  const approve = parsed.data.decision === "approve";
  const supabase = await createClient();
  const { error } = await supabase.rpc("review_course_purchase", {
    p_purchase_id: purchaseId,
    p_approve: approve,
    p_note: parsed.data.note,
  });
  if (error) return { message: error.message };

  await notifyCoursePurchaseReviewed(purchaseId, approve);
  if (approve) {
    const { data: p } = await supabase
      .from("course_purchases")
      .select("user_id, course_id, amount_cents")
      .eq("id", purchaseId)
      .single();
    if (p)
      track("course_purchased", p.user_id, {
        course_id: p.course_id,
        amount_cents: p.amount_cents,
      });
  }

  revalidatePath("/admin/course-payments");
  return {};
}

const settingsSchema = z.object({
  instructions_md: z.string().trim().max(3000),
  account_details: z.string().trim().max(1000),
});

export async function savePaymentSettings(
  _prev: FormState<"instructions_md">,
  formData: FormData,
): Promise<FormState<"instructions_md">> {
  await requireAdmin();
  const parsed = settingsSchema.safeParse({
    instructions_md: String(formData.get("instructions_md") ?? ""),
    account_details: String(formData.get("account_details") ?? ""),
  });
  if (!parsed.success) return { message: parsed.error.issues[0].message };

  const supabase = await createClient();
  const qrUrl = (formData.get("qr_url") as string) || null;
  const { error } = await supabase
    .from("payment_settings")
    .update({
      instructions_md: parsed.data.instructions_md || null,
      account_details: parsed.data.account_details || null,
      ...(qrUrl !== null ? { qr_url: qrUrl || null } : {}),
    })
    .eq("id", true);
  if (error) return { message: "Couldn't save payment settings." };

  revalidatePath("/admin/course-payments");
  return { message: "ok" };
}
