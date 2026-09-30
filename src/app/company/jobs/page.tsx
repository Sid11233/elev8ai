import { Briefcase, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { JobStatusBadge } from "@/components/job-status-badge";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireCompany } from "@/lib/auth";
import { formatDateTime } from "@/lib/datetime";
import { categoryLabel } from "@/lib/jobs";
import { formatPay, formatPayCap } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

import { duplicateCompanyJob, setCompanyJobStatus } from "./actions";

export const metadata: Metadata = { title: "My Jobs · Company · Elev8ai" };

export default async function CompanyJobsPage() {
  const { company } = await requireCompany();
  const supabase = await createClient();
  const { data: jobs } = await supabase
    .from("jobs")
    .select("*, skill:skills(name)")
    .eq("company_id", company.id)
    .order("created_at", { ascending: false });

  return (
    <>
      <PageHeader title="My Jobs" description="Post and manage your jobs.">
        <Button asChild className="h-10">
          <Link href="/company/jobs/new">
            <Plus className="size-4" /> New job
          </Link>
        </Button>
      </PageHeader>

      {!jobs?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Briefcase className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No jobs yet.{" "}
              <Link href="/company/jobs/new" className="text-primary">
                Post one
              </Link>
              .
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => {
            const cap = formatPayCap(job);
            return (
              <Card key={job.id}>
                <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/company/jobs/${job.id}`}
                        className="font-medium hover:underline"
                      >
                        {job.title}
                      </Link>
                      <JobStatusBadge status={job.status} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {categoryLabel(job.category)} · {job.spots_taken}/{job.slots} spots
                      {job.deadline && <> · due {formatDateTime(job.deadline)}</>}
                      {job.skill && <> · {job.skill.name} badge</>}
                    </p>
                    <p className="text-sm">
                      <span className="font-medium text-primary">{formatPay(job)}</span>
                      {cap && <span className="text-muted-foreground"> · {cap}</span>}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/company/jobs/${job.id}`}>Edit</Link>
                    </Button>
                    <form action={duplicateCompanyJob.bind(null, job.id)}>
                      <Button type="submit" variant="outline" size="sm">
                        Duplicate
                      </Button>
                    </form>
                    {job.status === "open" && (
                      <form action={setCompanyJobStatus.bind(null, job.id, "closed")}>
                        <Button type="submit" variant="outline" size="sm">
                          Close
                        </Button>
                      </form>
                    )}
                    {job.status === "closed" && (
                      <form action={setCompanyJobStatus.bind(null, job.id, "open")}>
                        <Button type="submit" variant="outline" size="sm">
                          Reopen
                        </Button>
                      </form>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
