import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { JobStatusBadge } from "@/components/job-status-badge";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";

import { getJobFormOptions } from "../form-options";
import { JobForm } from "../job-form";

export const metadata: Metadata = { title: "Edit job · Admin · Elev8ai" };

export default async function EditJobPage({ params }: PageProps<"/admin/jobs/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: job }, { companies, skills }] = await Promise.all([
    supabase.from("jobs").select("*").eq("id", id).maybeSingle(),
    getJobFormOptions(),
  ]);
  if (!job) notFound();

  return (
    <>
      <PageHeader title="Edit job">
        <JobStatusBadge status={job.status} />
      </PageHeader>
      <JobForm job={job} companies={companies} skills={skills} />
    </>
  );
}
