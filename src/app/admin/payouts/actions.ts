"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth";
import { notifyPayoutsPaid } from "@/lib/notify-events";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/lib/validation/form-state";

const PAYOUT_METHODS = ["bank", "juice", "wise", "paypal", "other"] as const;

const markPaidSchema = z.object({
  payout_ids: z.array(z.uuid()).min(1, "Tick at least one payout"),
  method: z.enum(PAYOUT_METHODS, "Choose how you sent the money"),
  reference: z.string().trim().max(200),
});

export async function markPayoutsPaid(
  _prev: FormState<"method">,
  formData: FormData,
): Promise<FormState<"method">> {
  await requireAdmin();
  const parsed = markPaidSchema.safeParse({
    payout_ids: formData.getAll("payout_ids").map(String),
    method: formData.get("method"),
    reference: String(formData.get("reference") ?? ""),
  });
  if (!parsed.success) return { message: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_payouts_paid", {
    p_payout_ids: parsed.data.payout_ids,
    p_method: parsed.data.method,
    p_reference: parsed.data.reference,
  });
  if (error) return { message: error.message };

  await notifyPayoutsPaid(parsed.data.payout_ids);

  revalidatePath("/admin/payouts");
  return {};
}
