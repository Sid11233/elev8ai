import { z } from "zod";

export const MIN_AGE = 18;
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

// Whole years between an ISO date (YYYY-MM-DD) and today.
export function ageOn(dateOfBirth: string, today = new Date()) {
  const [y, m, d] = dateOfBirth.split("-").map(Number);
  let age = today.getUTCFullYear() - y;
  const beforeBirthday =
    today.getUTCMonth() + 1 < m || (today.getUTCMonth() + 1 === m && today.getUTCDate() < d);
  if (beforeBirthday) age--;
  return age;
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep this under ${max} characters`)
    .transform((v) => (v === "" ? null : v));

export const onboardingSchema = z.object({
  full_name: z.string().trim().min(2, "Enter your full name").max(100),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_]{3,20}$/, "3–20 characters: letters, numbers and underscores only"),
  date_of_birth: z.iso
    .date("Enter your date of birth")
    .refine((v) => ageOn(v) >= MIN_AGE, `You need to be ${MIN_AGE} or older to join Elev8ai.`)
    .refine((v) => ageOn(v) <= 100, "Check your date of birth"),
  country: z.string().trim().min(2, "Enter your country").max(60),
  phone: optionalText(30).refine(
    (v) => v === null || /^\+?[0-9 ()-]{6,30}$/.test(v),
    "Enter a valid phone number",
  ),
  bio: optionalText(500),
  avatar: z
    .instanceof(File)
    .optional()
    .transform((f) => (f && f.size > 0 ? f : undefined))
    .refine((f) => !f || f.size <= AVATAR_MAX_BYTES, "Photo must be 2 MB or smaller")
    .refine(
      (f) => !f || (AVATAR_TYPES as readonly string[]).includes(f.type),
      "Photo must be a JPG, PNG or WebP image",
    ),
});

export type OnboardingField = keyof z.input<typeof onboardingSchema>;
