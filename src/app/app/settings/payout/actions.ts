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
  // Explicit update-or-insert rather than .upsert(): verified live that
  // PostgREST's INSERT ... ON CONFLICT DO UPDATE upsert path does not
  // reliably run the encrypt-on-write trigger on this table (a plain UPDATE
  // does), so this avoids silently storing data that can never be decrypted.
  const { data: updated, error: updateErr } = await supabase
    .from("payout_details")
    .update({ method, details })
    .eq("user_id", profile.user_id)
    .select("user_id");
  if (updateErr) return { message: "Couldn't save your payout details. Try again.", values };
  if (!updated || updated.length === 0) {
    const { error: insertErr } = await supabase
      .from("payout_details")
      .insert({ user_id: profile.user_id, method, details });
    if (insertErr) return { message: "Couldn't save your payout details. Try again.", values };
  }

  // Juice merchant QR (shown to the company at payment time). Only overwrite
  // when a new upload path is supplied; files are validated against the user's
  // folder in the juice-qr bucket.
  const qr = String(formData.get("juice_qr_url") ?? "").trim();
  if (qr) {
    if (!qr.startsWith(`${profile.user_id}/`) || qr.length > 500) {
      return { message: "Couldn't save your Juice QR. Try again.", values };
    }
    const publicUrl = supabase.storage.from("juice-qr").getPublicUrl(qr).data.publicUrl;
    await supabase.from("profiles").update({ juice_qr_url: publicUrl }).eq("user_id", profile.user_id);
  }

  revalidatePath("/app/settings/payout");
  return { message: "ok" };
}
