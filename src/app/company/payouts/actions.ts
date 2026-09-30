"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireCompany } from "@/lib/auth";
import { notifyPayoutsPaid } from "@/lib/notify-events";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/lib/validation/form-state";

const schema = z.object({
  payout_ids: z.array(z.uuid()).min(1, "Tick at least one payout"),
  method: z.enum(["bank", "juice", "wise", "paypal", "other"], "Choose how you sent the money"),
  reference: z.string().trim().max(200),
});

// mark_payouts_paid only pays out payouts on jobs the caller's company owns.
export async function markPayoutsPaid(
  _prev: FormState<"method">,
  formData: FormData,
): Promise<FormState<"method">> {
  await requireCompany();
  const parsed = schema.safeParse({
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
  revalidatePath("/company/payouts");
  return {};
}
