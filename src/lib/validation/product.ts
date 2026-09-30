import { z } from "zod";

import { parseMoneyToCents } from "@/lib/money";
import { slugify } from "@/lib/validation/company";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep this under ${max} characters`)
    .transform((v) => (v === "" ? null : v));

export const productSchema = z
  .object({
    title: z.string().trim().min(2, "Enter a product title").max(120),
    slug: z.string().trim().toLowerCase(),
    summary: optionalText(300),
    description: optionalText(5000),
    price: z.string().transform((v, ctx) => {
      const cents = parseMoneyToCents(v);
      if (cents === null) {
        ctx.addIssue({ code: "custom", message: "Enter a price like 12 or 19.99" });
        return z.NEVER;
      }
      return cents;
    }),
    file_path: optionalText(500),
    file_name: optionalText(200),
    intent: z.enum(["draft", "publish", "save"]),
  })
  .transform((p) => ({ ...p, slug: p.slug || slugify(p.title) }))
  .refine((p) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(p.slug), {
    path: ["slug"],
    message: "Lowercase letters, numbers and dashes only",
  });

export type ProductField = "title" | "slug" | "summary" | "description" | "price" | "file";
