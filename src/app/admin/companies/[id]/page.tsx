import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";

import { CompanyForm } from "../company-form";

export const metadata: Metadata = { title: "Edit company · Admin · Elev8ai" };

export default async function EditCompanyPage({ params }: PageProps<"/admin/companies/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: company } = await supabase.from("companies").select("*").eq("id", id).maybeSingle();
  if (!company) notFound();

  return (
    <>
      <PageHeader title={`Edit ${company.name}`} />
      <CompanyForm company={company} />
    </>
  );
}
