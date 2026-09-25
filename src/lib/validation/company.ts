import { z } from "zod";

export const LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const LOGO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep this under ${max} characters`)
    .transform((v) => (v === "" ? null : v));

export const companySchema = z
  .object({
    name: z.string().trim().min(2, "Enter the company name").max(100),
    slug: z.string().trim().toLowerCase(),
    description: optionalText(2000),
    website: optionalText(300).refine(
      (v) => v === null || /^https?:\/\/\S+\.\S+/.test(v),
      "Enter a full URL starting with https://",
    ),
    logo: z
      .instanceof(File)
      .optional()
      .transform((f) => (f && f.size > 0 ? f : undefined))
      .refine((f) => !f || f.size <= LOGO_MAX_BYTES, "Logo must be 2 MB or smaller")
      .refine(
        (f) => !f || (LOGO_TYPES as readonly string[]).includes(f.type),
        "Logo must be a JPG, PNG or WebP image",
      ),
  })
  .transform((c) => ({ ...c, slug: c.slug || slugify(c.name) }))
  .refine((c) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(c.slug), {
    path: ["slug"],
    message: "Lowercase letters, numbers and dashes only",
  });

export type CompanyField = "name" | "slug" | "description" | "website" | "logo";
