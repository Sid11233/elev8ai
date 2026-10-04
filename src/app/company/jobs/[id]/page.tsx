import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { JobForm } from "@/app/admin/jobs/job-form";
import { AssetsManager } from "@/components/jobs/assets-manager";
import { JobStatusBadge } from "@/components/job-status-badge";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireCompany } from "@/lib/auth";
import { getProofTemplates } from "@/lib/proof-templates";
import { createClient } from "@/lib/supabase/server";

import { saveCompanyJob } from "../actions";

export const metadata: Metadata = { title: "Edit job · Company · lockedinnn" };

export default async function EditCompanyJobPage({ params }: PageProps<"/company/jobs/[id]">) {
  const { id } = await params;
  const { company } = await requireCompany();
  const supabase = await createClient();
  const [{ data: job }, { data: skills }, { data: assets }, proofTemplates] = await Promise.all([
    supabase.from("jobs").select("*").eq("id", id).eq("company_id", company.id).maybeSingle(),
    supabase.from("skills").select("id, name").order("name"),
    supabase
      .from("job_assets")
      .select("id, kind, role, label, url, domain, link_status, scan_status")
      .eq("job_id", id)
      .is("deleted_at", null)
      .order("created_at"),
    getProofTemplates(),
  ]);
  if (!job) notFound();

  return (
    <>
      <PageHeader title="Edit job">
        <JobStatusBadge status={job.status} />
      </PageHeader>
      <div className="space-y-6">
        <JobForm
          job={job}
          companies={[]}
          skills={skills ?? []}
          lockedCompanyId={company.id}
          action={saveCompanyJob.bind(null, job.id)}
          proofTemplates={proofTemplates}
        />
        <Card>
          <CardHeader>
            <CardTitle>Assets for the talent</CardTitle>
          </CardHeader>
          <CardContent>
            <AssetsManager jobId={job.id} assets={assets ?? []} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
