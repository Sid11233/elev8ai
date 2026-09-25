import { z } from "zod";

import { parseMoneyToCents } from "@/lib/money";
import { slugify } from "@/lib/validation/company";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep this under ${max} characters`)
    .transform((v) => (v === "" ? null : v));

export const courseSchema = z
  .object({
    title: z.string().trim().min(2, "Enter a course title").max(120),
    slug: z.string().trim().toLowerCase(),
    description: optionalText(3000),
    price: z.string().transform((v, ctx) => {
      const cents = parseMoneyToCents(v);
      if (cents === null) {
        ctx.addIssue({ code: "custom", message: "Enter a price like 12 or 19.99" });
        return z.NEVER;
      }
      return cents;
    }),
    skill_id: z.union([z.uuid(), z.literal("")]).transform((v) => v || null),
    lemon_variant_id: optionalText(60),
    intent: z.enum(["draft", "publish", "save"]),
  })
  .transform((c) => ({ ...c, slug: c.slug || slugify(c.title) }))
  .refine((c) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(c.slug), {
    path: ["slug"],
    message: "Lowercase letters, numbers and dashes only",
  })
  .refine((c) => c.intent !== "publish" || !!c.lemon_variant_id, {
    path: ["lemon_variant_id"],
    message: "Add the Lemon Squeezy variant id before publishing (buyers can't pay without it)",
  });

export type CourseField =
  "title" | "slug" | "description" | "price" | "skill_id" | "lemon_variant_id";

export const lessonSchema = z.object({
  title: z.string().trim().min(2, "Enter a lesson title").max(200),
  position: z
    .string()
    .trim()
    .regex(/^\d{1,4}$/, "Position must be a whole number")
    .transform(Number),
  body_md: optionalText(20000),
  video_id: optionalText(100),
});

export type LessonField = "title" | "position" | "body_md" | "video_id";
