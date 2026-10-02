"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireCompany } from "@/lib/auth";
import { JOB_CATEGORIES } from "@/lib/jobs";
import { createClient } from "@/lib/supabase/server";
import { type FormState, fieldErrorsOf, textValues } from "@/lib/validation/form-state";

export type CompanyProfileField =
  "name" | "type" | "phone" | "services" | "description" | "website";

const schema = z.object({
  name: z.string().trim().min(2, "Enter your company name").max(100),
  type: z.string().trim().max(60).optional(),
  phone: z
    .string()
    .trim()
    .max(30)
    .refine((v) => v === "" || /^\+?[0-9 ()-]{6,30}$/.test(v), "Enter a valid phone number"),
  description: z.string().trim().max(2000).optional(),
  website: z
    .string()
    .trim()
    .max(300)
    .refine(
      (v) => v === "" || /^https?:\/\/\S+\.\S+/.test(v),
      "Enter a full URL starting with https://",
    ),
});

export async function saveCompanyProfile(
  _prev: FormState<CompanyProfileField>,
  formData: FormData,
): Promise<FormState<CompanyProfileField>> {
  const { company } = await requireCompany();
  const values = textValues(formData, ["name", "type", "phone", "description", "website"] as const);
  const parsed = schema.safeParse(values);
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), values };

  const services = formData
    .getAll("services")
    .map(String)
    .filter((s) => (JOB_CATEGORIES as readonly string[]).includes(s));

  const supabase = await createClient();
  const { error } = await supabase
    .from("companies")
    .update({
      name: parsed.data.name,
      type: parsed.data.type || null,
      phone: parsed.data.phone || null,
      description: parsed.data.description || null,
      website: parsed.data.website || null,
      services,
    })
    .eq("id", company.id);
  if (error) return { message: "Couldn't save. Try again.", values };

  revalidatePath("/company/profile");
  return { message: "ok" };
}
