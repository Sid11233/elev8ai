"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { track } from "@/lib/analytics";
import { getCurrentUser } from "@/lib/auth";
import { SERVICE_CATEGORIES } from "@/lib/jobs";
import { createClient } from "@/lib/supabase/server";
import { type FormState, fieldErrorsOf, textValues } from "@/lib/validation/form-state";

export type CompanyOnboardingField = "name" | "type" | "phone" | "services" | "description";

const schema = z.object({
  name: z.string().trim().min(2, "Enter your company name").max(100),
  type: z.string().trim().max(60).optional(),
  phone: z
    .string()
    .trim()
    .max(30)
    .refine((v) => v === "" || /^\+?[0-9 ()-]{6,30}$/.test(v), "Enter a valid phone number"),
  description: z.string().trim().max(2000).optional(),
});

export async function completeCompanyOnboarding(
  _prev: FormState<CompanyOnboardingField>,
  formData: FormData,
): Promise<FormState<CompanyOnboardingField>> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const values = textValues(formData, ["name", "type", "phone", "description"] as const);
  const parsed = schema.safeParse(values);
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), values };

  // Services: only the known job categories.
  const services = formData
    .getAll("services")
    .map(String)
    .filter((s) => (SERVICE_CATEGORIES as readonly string[]).includes(s));
  if (services.length === 0) {
    return { fieldErrors: { services: "Pick at least one service" }, values };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_company", {
    p_name: parsed.data.name,
    p_type: parsed.data.type ?? "Agency",
    p_phone: parsed.data.phone,
    p_services: services,
    p_description: parsed.data.description ?? "",
  });
  if (error) return { message: error.message, values };

  track("signed_up", user.id, { kind: "company" });
  redirect("/company");
}
