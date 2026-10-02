import type { Metadata } from "next";

import { JobForm } from "@/app/admin/jobs/job-form";
import { PageHeader } from "@/components/page-header";
import { requireCompany } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

import { saveCompanyJob } from "../actions";

export const metadata: Metadata = { title: "New job · Company · lockedinnn" };

export default async function NewCompanyJobPage() {
  const { company } = await requireCompany();
  const supabase = await createClient();
  const { data: skills } = await supabase.from("skills").select("id, name").order("name");
  return (
    <>
      <PageHeader title="New job" />
      <JobForm
        companies={[]}
        skills={skills ?? []}
        lockedCompanyId={company.id}
        action={saveCompanyJob.bind(null, null)}
      />
    </>
  );
}
