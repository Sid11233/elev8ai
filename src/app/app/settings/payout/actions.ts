"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireOnboardedProfile } from "@/lib/auth";
import { payoutMethod } from "@/lib/payout-methods";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/lib/validation/form-state";

const methodSchema = z.enum(["bank", "juice", "wise", "paypal"]);

export type PayoutFormState = FormState<"method" | string>;

// Saves the current user's payout details. Each method requires its own fields.
export async function savePayoutDetails(
  _prev: PayoutFormState,
  formData: FormData,
): Promise<PayoutFormState> {
  const profile = await requireOnboardedProfile();

  const methodParsed = methodSchema.safeParse(formData.get("method"));
  if (!methodParsed.success) return { fieldErrors: { method: "Choose a payout method" } };
  const method = methodParsed.data;
  const config = payoutMethod(method)!;

  const details: Record<string, string> = {};
  const fieldErrors: Record<string, string> = {};
  const values: Record<string, string> = { method };
  for (const field of config.fields) {
    const value = String(formData.get(field.key) ?? "").trim();
    values[field.key] = value;
    if (!value) fieldErrors[field.key] = `Enter your ${field.label.toLowerCase()}`;
    else if (value.length > 200) fieldErrors[field.key] = "Too long";
    else details[field.key] = value;
  }
  if (Object.keys(fieldErrors).length) return { fieldErrors, values };

  const supabase = await createClient();
  const { error } = await supabase
    .from("payout_details")
    .upsert({ user_id: profile.user_id, method, details }, { onConflict: "user_id" });
  if (error) return { message: "Couldn't save your payout details. Please try again.", values };

  revalidatePath("/app/settings/payout");
  return { message: "ok" };
}
