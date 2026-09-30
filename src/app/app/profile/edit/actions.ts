"use server";

import { revalidatePath } from "next/cache";

import { requireOnboardedProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { type FormState, fieldErrorsOf, textValues } from "@/lib/validation/form-state";
import { type ProfileEditField, profileEditSchema } from "@/lib/validation/profile";

const FIELDS = ["headline", "about", "bio", "country", "phone"] as const;

export async function saveProfile(
  _prev: FormState<ProfileEditField>,
  formData: FormData,
): Promise<FormState<ProfileEditField>> {
  const profile = await requireOnboardedProfile();
  const values = textValues(formData, FIELDS);
  const parsed = profileEditSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), values };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update(parsed.data)
    .eq("user_id", profile.user_id);
  if (error) return { message: "Couldn't save your profile. Please try again.", values };

  revalidatePath("/app/profile");
  return { message: "ok" };
}
