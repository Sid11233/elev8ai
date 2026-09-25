import type { Metadata } from "next";

import { PageHeader } from "@/components/page-header";

import { CompanyForm } from "../company-form";

export const metadata: Metadata = { title: "New company · Admin · Elev8ai" };

export default function NewCompanyPage() {
  return (
    <>
      <PageHeader title="New company" />
      <CompanyForm />
    </>
  );
}
