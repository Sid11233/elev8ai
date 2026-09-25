import { z } from "zod";

import { localInputToIso } from "@/lib/datetime";
import { JOB_CATEGORIES } from "@/lib/jobs";
import { parseMoneyToCents } from "@/lib/money";

export const JOB_INTENTS = ["draft", "publish", "save"] as const;
export type JobIntent = (typeof JOB_INTENTS)[number];

const wholeNumber = (label: string, max: number) =>
  z
    .string()
    .trim()
    .regex(/^\d+$/, `${label} must be a whole number`)
    .transform(Number)
    .refine((n) => n >= 1 && n <= max, `${label} must be between 1 and ${max}`);

export const jobSchema = z
  .object({
    company_id: z.uuid("Choose a company"),
    title: z.string().trim().min(3, "Give the job a title").max(120),
    description: z.string().trim().min(1, "Describe the job").max(5000),
    category: z.enum(JOB_CATEGORIES, "Choose a category"),
    pay: z.string().transform((v, ctx) => {
      const cents = parseMoneyToCents(v);
      if (cents === null || cents <= 0) {
        ctx.addIssue({ code: "custom", message: "Enter an amount like 5 or 12.50" });
        return z.NEVER;
      }
      return cents;
    }),
    pay_type: z.enum(["fixed", "per_unit"]),
    unit_label: z.string().trim().max(30, "Keep the unit short, e.g. clip"),
    max_units: z.string().trim(),
    slots: wholeNumber("Spots", 1000),
    required_skill_id: z.union([z.uuid(), z.literal("")]).transform((v) => v || null),
    deadline: z
      .string()
      .trim()
      .transform((v, ctx) => {
        if (!v) return null;
        const iso = localInputToIso(v);
        if (!iso) {
          ctx.addIssue({ code: "custom", message: "Enter a valid date and time" });
          return z.NEVER;
        }
        return iso;
      }),
    proof_instructions: z.string().trim().max(3000),
    intent: z.enum(JOB_INTENTS),
  })
  .superRefine((job, ctx) => {
    if (job.pay_type === "per_unit") {
      if (!job.unit_label) {
        ctx.addIssue({
          code: "custom",
          path: ["unit_label"],
          message: "Say what one unit is, e.g. clip",
        });
      }
      if (
        !/^\d+$/.test(job.max_units) ||
        Number(job.max_units) < 1 ||
        Number(job.max_units) > 10000
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["max_units"],
          message: "Max units must be a whole number between 1 and 10000",
        });
      }
    }
    if (job.intent === "publish" && !job.proof_instructions) {
      ctx.addIssue({
        code: "custom",
        path: ["proof_instructions"],
        message: "Add proof instructions before publishing, so talent know what to submit",
      });
    }
  })
  .transform(({ pay, unit_label, max_units, intent, ...job }) => ({
    intent,
    values: {
      ...job,
      pay_cents: pay,
      unit_label: job.pay_type === "per_unit" ? unit_label : null,
      max_units: job.pay_type === "per_unit" ? Number(max_units) : null,
    },
  }));

export type JobField =
  | "company_id"
  | "title"
  | "description"
  | "category"
  | "pay"
  | "pay_type"
  | "unit_label"
  | "max_units"
  | "slots"
  | "required_skill_id"
  | "deadline"
  | "proof_instructions";
