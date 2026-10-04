import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AssetsManager } from "@/components/jobs/assets-manager";
import { JobStatusBadge } from "@/components/job-status-badge";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getProofTemplates } from "@/lib/proof-templates";
import { createClient } from "@/lib/supabase/server";

import { getJobFormOptions } from "../form-options";
import { JobForm } from "../job-form";

export const metadata: Metadata = { title: "Edit job · Admin · lockedinnn" };

export default async function EditJobPage({ params }: PageProps<"/admin/jobs/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: job }, { companies, skills }, { data: assets }, proofTemplates] = await Promise.all([
    supabase.from("jobs").select("*").eq("id", id).maybeSingle(),
    getJobFormOptions(),
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
        <JobForm job={job} companies={companies} skills={skills} proofTemplates={proofTemplates} />
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
