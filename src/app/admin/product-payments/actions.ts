"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { track } from "@/lib/analytics";
import { requireAdmin } from "@/lib/auth";
import { notifyProductPurchaseReviewed } from "@/lib/notify-events";
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

export async function reviewProductPurchase(
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
  const { error } = await supabase.rpc("review_product_purchase", {
    p_purchase_id: purchaseId,
    p_approve: approve,
    p_note: parsed.data.note,
  });
  if (error) return { message: error.message };

  await notifyProductPurchaseReviewed(purchaseId, approve);
  if (approve) {
    const { data: p } = await supabase
      .from("product_purchases")
      .select("user_id, product_id, amount_cents")
      .eq("id", purchaseId)
      .single();
    if (p)
      track("product_purchased", p.user_id, {
        product_id: p.product_id,
        amount_cents: p.amount_cents,
      });
  }

  revalidatePath("/admin/product-payments");
  return {};
}
