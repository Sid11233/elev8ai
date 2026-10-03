"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireCompany } from "@/lib/auth";
import { SERVICE_CATEGORIES } from "@/lib/jobs";
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
    .filter((s) => (SERVICE_CATEGORIES as readonly string[]).includes(s));

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

export type BankField = "beneficiary_name" | "bank_name" | "account_number";

const bankSchema = z.object({
  beneficiary_name: z.string().trim().max(120).optional(),
  bank_name: z.string().trim().max(120).optional(),
  account_number: z.string().trim().max(60).optional(),
});

// Bank/beneficiary details used only for dispute refunds, not routine payouts.
export async function saveCompanyBankDetails(
  _prev: FormState<BankField>,
  formData: FormData,
): Promise<FormState<BankField>> {
  const { company } = await requireCompany();
  const values = textValues(
    formData,
    ["beneficiary_name", "bank_name", "account_number"] as const,
  );
  const parsed = bankSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), values };

  const supabase = await createClient();
  const { error } = await supabase.from("company_bank_details").upsert(
    {
      company_id: company.id,
      beneficiary_name: parsed.data.beneficiary_name || null,
      bank_name: parsed.data.bank_name || null,
      account_number: parsed.data.account_number || null,
    },
    { onConflict: "company_id" },
  );
  if (error) return { message: "Couldn't save. Try again.", values };

  revalidatePath("/company/profile");
  return { message: "ok" };
}
