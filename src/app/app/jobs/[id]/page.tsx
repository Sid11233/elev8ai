import { ArrowLeft, CalendarClock, ExternalLink, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CompanyLogo } from "@/components/company-logo";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/datetime";
import { getJobForTalent, spotsLeft } from "@/lib/job-board";
import { categoryLabel } from "@/lib/jobs";
import { formatPay, formatPayCap } from "@/lib/money";

import { JobAction } from "./job-action";

export const metadata: Metadata = { title: "Job · Elev8ai" };

export default async function JobDetailPage({ params }: PageProps<"/app/jobs/[id]">) {
  const { id } = await params;
  const job = await getJobForTalent(id);
  if (!job) notFound();

  const cap = formatPayCap(job);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link
        href="/app/jobs"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> All jobs
      </Link>

      <Card>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3">
            <CompanyLogo
              name={job.company?.name ?? "?"}
              src={job.company?.logo_url ?? null}
              className="size-12"
            />
            <div className="min-w-0">
              <h1 className="text-xl leading-snug font-semibold">{job.title}</h1>
              <p className="text-sm text-muted-foreground">{job.company?.name}</p>
            </div>
          </div>

          <div>
            <p className="text-2xl font-semibold text-primary">{formatPay(job)}</p>
            {cap && <p className="text-sm text-muted-foreground">{cap}</p>}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
            <Badge variant="secondary">{categoryLabel(job.category)}</Badge>
            <span className="inline-flex items-center gap-1.5">
              <Users className="size-4" />
              {spotsLeft(job)} of {job.slots} {job.slots === 1 ? "spot" : "spots"} left
            </span>
            {job.deadline && (
              <span className="inline-flex items-center gap-1.5">
                <CalendarClock className="size-4" />
                Due {formatDateTime(job.deadline)}
              </span>
            )}
          </div>

          <JobAction job={job} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>About the job</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed whitespace-pre-line">{job.description}</p>
        </CardContent>
      </Card>

      {job.proof_instructions && (
        <Card>
          <CardHeader>
            <CardTitle>What to submit</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed whitespace-pre-line">{job.proof_instructions}</p>
          </CardContent>
        </Card>
      )}

      {job.company && (
        <Card>
          <CardHeader>
            <CardTitle>About {job.company.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {job.company.description && (
              <p className="text-sm text-muted-foreground">{job.company.description}</p>
            )}
            {job.company.website && (
              <a
                href={job.company.website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-primary"
              >
                Website <ExternalLink className="size-3.5" />
              </a>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
