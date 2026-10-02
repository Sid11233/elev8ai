import { ArrowLeft, CalendarClock, CheckCircle2, ExternalLink, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ApplyForm } from "@/app/app/jobs/[id]/apply-form";
import { CompanyLogo } from "@/components/company-logo";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireCompany } from "@/lib/auth";
import { formatDateTime } from "@/lib/datetime";
import { spotsLeft } from "@/lib/job-board";
import { categoryLabel } from "@/lib/jobs";
import { formatPay, formatPayCap } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

import { applyAsCompany } from "../actions";

export const metadata: Metadata = { title: "Job · Find work · lockedinnn" };

const JOB_SELECT = "*, company:companies(id, name, logo_url, description, website)";

export default async function CompanyFindWorkDetailPage({
  params,
}: PageProps<"/company/find-work/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { profile, company } = await requireCompany();
  const supabase = await createClient();

  const { data: job } = await supabase.from("jobs").select(JOB_SELECT).eq("id", id).maybeSingle();
  // Only open jobs posted by another company.
  if (!job || job.status !== "open" || !job.company?.id || job.company.id === company.id) {
    notFound();
  }

  const { data: application } = await supabase
    .from("applications")
    .select("id, status, decision_note")
    .eq("job_id", id)
    .eq("user_id", profile.user_id)
    .maybeSingle();

  const cap = formatPayCap(job);
  const expired = !!job.deadline && new Date(job.deadline) < new Date();
  const canApply =
    !expired && spotsLeft(job) > 0 && (!application || application.status === "withdrawn");

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link
        href="/company/find-work"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Find work
      </Link>

      <Card>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3">
            <CompanyLogo name={job.company.name} src={job.company.logo_url} className="size-12" />
            <div className="min-w-0">
              <h1 className="text-xl leading-snug font-semibold">{job.title}</h1>
              <p className="text-sm text-muted-foreground">{job.company.name}</p>
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

          {application && application.status !== "withdrawn" ? (
            <div className="space-y-1 rounded-lg bg-secondary/50 p-3 text-sm">
              <p className="inline-flex items-center gap-1.5 font-medium">
                <CheckCircle2 className="size-4 text-primary" />
                {application.status === "accepted"
                  ? "You were accepted for this job"
                  : application.status === "rejected"
                    ? "Not selected this time"
                    : "Application sent"}
              </p>
              {application.decision_note && (
                <p className="whitespace-pre-line text-muted-foreground">
                  {application.decision_note}
                </p>
              )}
            </div>
          ) : canApply ? null : (
            <p className="text-sm text-muted-foreground">
              This job isn&apos;t taking applications.
            </p>
          )}
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

      {job.company.description && (
        <Card>
          <CardHeader>
            <CardTitle>About {job.company.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">{job.company.description}</p>
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

      {canApply && (
        <Card>
          <CardHeader>
            <CardTitle>Apply for this job</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Show off your company — link past work so they pick you.
            </p>
            <ApplyForm
              jobId={job.id}
              userId={profile.user_id}
              action={applyAsCompany.bind(null, job.id)}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
