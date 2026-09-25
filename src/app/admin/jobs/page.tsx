import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { CompanyLogo } from "@/components/company-logo";
import { JobStatusBadge } from "@/components/job-status-badge";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { formatDateTime } from "@/lib/datetime";
import {
  CATEGORY_LABELS,
  categoryLabel,
  isJobCategory,
  isJobStatus,
  JOB_CATEGORIES,
  JOB_STATUSES,
  STATUS_LABELS,
} from "@/lib/jobs";
import { formatPay, formatPayCap } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

import { duplicateJob, setJobStatus } from "./actions";

export const metadata: Metadata = { title: "Jobs · Admin · Elev8ai" };

export default async function AdminJobsPage({ searchParams }: PageProps<"/admin/jobs">) {
  const params = await searchParams;
  const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");
  const filters = {
    company: one(params.company),
    status: one(params.status),
    category: one(params.category),
  };

  const supabase = await createClient();
  const { data: companies } = await supabase.from("companies").select("id, name").order("name");

  let query = supabase
    .from("jobs")
    .select("*, company:companies(name, logo_url), skill:skills(name)")
    .order("created_at", { ascending: false });
  if (/^[0-9a-f-]{36}$/i.test(filters.company)) query = query.eq("company_id", filters.company);
  if (isJobStatus(filters.status)) query = query.eq("status", filters.status);
  if (isJobCategory(filters.category)) query = query.eq("category", filters.category);
  const { data: jobs } = await query;

  return (
    <>
      <PageHeader title="Jobs" description="Post, publish and manage jobs.">
        <Button asChild className="h-10">
          <Link href="/admin/jobs/new">
            <Plus className="size-4" /> New job
          </Link>
        </Button>
      </PageHeader>

      <form className="mb-5 grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]" method="get">
        <NativeSelect name="company" defaultValue={filters.company} aria-label="Company">
          <option value="">All companies</option>
          {(companies ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect name="status" defaultValue={filters.status} aria-label="Status">
          <option value="">All statuses</option>
          {JOB_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect name="category" defaultValue={filters.category} aria-label="Category">
          <option value="">All categories</option>
          {JOB_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </NativeSelect>
        <Button type="submit" variant="secondary" className="h-11">
          Filter
        </Button>
      </form>

      {!jobs?.length ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No jobs match.{" "}
            <Link href="/admin/jobs/new" className="text-primary">
              Post one
            </Link>
            .
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => {
            const cap = formatPayCap(job);
            return (
              <Card key={job.id}>
                <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 gap-3">
                    <CompanyLogo
                      name={job.company?.name ?? "?"}
                      src={job.company?.logo_url ?? null}
                    />
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/admin/jobs/${job.id}`}
                          className="font-medium hover:underline"
                        >
                          {job.title}
                        </Link>
                        <JobStatusBadge status={job.status} />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {job.company?.name} · {categoryLabel(job.category)} · {job.slots}{" "}
                        {job.slots === 1 ? "spot" : "spots"}
                        {job.deadline && <> · due {formatDateTime(job.deadline)}</>}
                        {job.skill && <> · {job.skill.name} badge</>}
                      </p>
                      <p className="text-sm">
                        <span className="font-medium text-primary">{formatPay(job)}</span>
                        {cap && <span className="text-muted-foreground"> · {cap}</span>}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/admin/jobs/${job.id}`}>Edit</Link>
                    </Button>
                    <form action={duplicateJob.bind(null, job.id)}>
                      <Button type="submit" variant="outline" size="sm">
                        Duplicate
                      </Button>
                    </form>
                    {job.status === "open" && (
                      <form action={setJobStatus.bind(null, job.id, "closed")}>
                        <Button type="submit" variant="outline" size="sm">
                          Close
                        </Button>
                      </form>
                    )}
                    {job.status === "closed" && (
                      <form action={setJobStatus.bind(null, job.id, "open")}>
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
