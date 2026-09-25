"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { track } from "@/lib/analytics";
import { getCurrentUser, homePathFor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { type OnboardingField, onboardingSchema } from "@/lib/validation/profile";

export type OnboardingState = {
  message?: string;
  fieldErrors?: Partial<Record<OnboardingField, string>>;
  values?: Partial<Record<Exclude<OnboardingField, "avatar">, string>>;
};

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function completeOnboarding(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const raw = {
    full_name: String(formData.get("full_name") ?? ""),
    username: String(formData.get("username") ?? ""),
    date_of_birth: String(formData.get("date_of_birth") ?? ""),
    country: String(formData.get("country") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    bio: String(formData.get("bio") ?? ""),
  };
  const avatar = formData.get("avatar");
  const parsed = onboardingSchema.safeParse({
    ...raw,
    avatar: avatar instanceof File ? avatar : undefined,
  });

  if (!parsed.success) {
    const flat = z.flattenError(parsed.error).fieldErrors;
    const fieldErrors: OnboardingState["fieldErrors"] = {};
    for (const [key, messages] of Object.entries(flat)) {
      if (messages?.[0]) fieldErrors[key as OnboardingField] = messages[0];
    }
    return { fieldErrors, values: raw };
  }

  const { avatar: file, ...fields } = parsed.data;
  const supabase = await createClient();

  let avatarUrl: string | undefined;
  if (file) {
    const path = `${user.id}/avatar-${Date.now()}.${EXTENSIONS[file.type]}`;
    const { error } = await supabase.storage
      .from("avatars")
      .upload(path, file, { contentType: file.type });
    if (error) {
      return {
        fieldErrors: { avatar: "We couldn't upload that photo. Try another one." },
        values: raw,
      };
    }
    avatarUrl = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .update({ ...fields, ...(avatarUrl ? { avatar_url: avatarUrl } : {}), onboarded: true })
    .eq("user_id", user.id)
    .select("onboarded, role")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { fieldErrors: { username: "That username is taken. Try another." }, values: raw };
    }
    // check_violation from the database's own 18+ / completeness rules.
    if (error.code === "23514") return { message: error.message, values: raw };
    return { message: "Something went wrong saving your profile. Please try again.", values: raw };
  }

  track("onboarded", user.id, { country: fields.country });
  redirect(homePathFor(profile));
}
