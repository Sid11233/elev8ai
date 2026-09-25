"use server";

import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { type CompanyField, companySchema } from "@/lib/validation/company";
import { type FormState, fieldErrorsOf, textValues } from "@/lib/validation/form-state";

const FIELDS = ["name", "slug", "description", "website"] as const;
const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

// Create (companyId null) or update a company. Bound with the id in the form.
export async function saveCompany(
  companyId: string | null,
  _prev: FormState<CompanyField>,
  formData: FormData,
): Promise<FormState<CompanyField>> {
  await requireAdmin();

  const values = textValues(formData, FIELDS);
  const logo = formData.get("logo");
  const parsed = companySchema.safeParse({
    ...values,
    logo: logo instanceof File ? logo : undefined,
  });
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), values };

  const { logo: file, ...fields } = parsed.data;
  const supabase = await createClient();

  const saved = companyId
    ? await supabase.from("companies").update(fields).eq("id", companyId).select("id").single()
    : await supabase.from("companies").insert(fields).select("id").single();

  if (saved.error) {
    if (saved.error.code === "23505") {
      return { fieldErrors: { slug: "Another company already uses this slug" }, values };
    }
    return { message: "Couldn't save the company. Please try again.", values };
  }

  if (file) {
    const path = `${saved.data.id}/logo-${Date.now()}.${EXTENSIONS[file.type]}`;
    const upload = await supabase.storage
      .from("company-logos")
      .upload(path, file, { contentType: file.type });
    if (upload.error) {
      return { fieldErrors: { logo: "Saved, but the logo upload failed. Try again." }, values };
    }
    const logoUrl = supabase.storage.from("company-logos").getPublicUrl(path).data.publicUrl;
    await supabase.from("companies").update({ logo_url: logoUrl }).eq("id", saved.data.id);
  }

  redirect("/admin/companies");
}
