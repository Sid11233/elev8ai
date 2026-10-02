import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { JobForm } from "@/app/admin/jobs/job-form";
import { JobStatusBadge } from "@/components/job-status-badge";
import { PageHeader } from "@/components/page-header";
import { requireCompany } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

import { saveCompanyJob } from "../actions";

export const metadata: Metadata = { title: "Edit job · Company · lockedinnn" };

export default async function EditCompanyJobPage({ params }: PageProps<"/company/jobs/[id]">) {
  const { id } = await params;
  const { company } = await requireCompany();
  const supabase = await createClient();
  const [{ data: job }, { data: skills }] = await Promise.all([
    supabase.from("jobs").select("*").eq("id", id).eq("company_id", company.id).maybeSingle(),
    supabase.from("skills").select("id, name").order("name"),
  ]);
  if (!job) notFound();

  return (
    <>
      <PageHeader title="Edit job">
        <JobStatusBadge status={job.status} />
      </PageHeader>
      <JobForm
        job={job}
        companies={[]}
        skills={skills ?? []}
        lockedCompanyId={company.id}
        action={saveCompanyJob.bind(null, job.id)}
      />
    </>
  );
}
