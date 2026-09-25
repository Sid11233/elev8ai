import { ArrowLeft, CheckCircle2, Clock, PencilLine, XCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { CompanyLogo } from "@/components/company-logo";
import { SubmissionCard } from "@/components/submission-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/datetime";
import { formatPay, formatPayCap } from "@/lib/money";
import { getMyApplication } from "@/lib/my-jobs";
import { signSubmissionFiles } from "@/lib/submission-files";

import { SubmitWorkForm } from "./submit-work-form";

export const metadata: Metadata = { title: "My job · Elev8ai" };

export default async function MyJobPage({ params }: PageProps<"/app/my-jobs/[id]">) {
  const { id } = await params;
  const user = await requireUser();
  const app = await getMyApplication(id);
  if (!app || !app.job) notFound();
  // Only accepted applications have work to do; others live on the job page.
  if (app.status !== "accepted") redirect(`/app/jobs/${app.job.id}`);

  const job = app.job;
  const history = [...app.submissions].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const fileUrls = await signSubmissionFiles(history.flatMap((s) => s.file_paths));
  const cap = formatPayCap(job);
  const latest = app.latest;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link
        href="/app/my-jobs"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> My Jobs
      </Link>

      <Card>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-3">
            <CompanyLogo name={job.company?.name ?? "?"} src={job.company?.logo_url ?? null} />
            <div className="min-w-0">
              <h1 className="text-xl leading-snug font-semibold">{job.title}</h1>
              <p className="text-sm text-muted-foreground">{job.company?.name}</p>
            </div>
          </div>
          <div>
            <p className="text-lg font-semibold text-primary">{formatPay(job)}</p>
            {cap && <p className="text-xs text-muted-foreground">{cap}</p>}
          </div>
          {job.deadline && (
            <p className="text-sm text-muted-foreground">Due {formatDateTime(job.deadline)}</p>
          )}
          <Link href={`/app/jobs/${job.id}`} className="text-sm text-primary">
            View job details
          </Link>
        </CardContent>
      </Card>

      {app.stage === "in_progress" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PencilLine className="size-4 text-primary" />
              {latest?.status === "changes_requested" ? "Resubmit your work" : "Submit your work"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {latest?.status === "changes_requested" && latest.reviewer_note && (
              <div className="rounded-lg bg-amber-400/10 p-3 text-sm">
                <p className="mb-1 text-xs font-medium text-amber-300">Changes requested</p>
                <p className="whitespace-pre-line">{latest.reviewer_note}</p>
              </div>
            )}
            {job.proof_instructions && (
              <div className="rounded-lg bg-secondary/60 p-3 text-sm">
                <p className="mb-1 text-xs font-medium text-muted-foreground">What to submit</p>
                <p className="whitespace-pre-line">{job.proof_instructions}</p>
              </div>
            )}
            <SubmitWorkForm
              applicationId={app.id}
              userId={user.id}
              unitLabel={job.pay_type === "per_unit" ? job.unit_label : null}
              maxUnits={job.max_units}
            />
          </CardContent>
        </Card>
      )}

      {app.stage === "submitted" && (
        <Card>
          <CardContent className="flex items-start gap-3">
            <Clock className="mt-0.5 size-5 text-muted-foreground" />
            <div>
              <p className="font-medium">Your work is being reviewed</p>
              <p className="text-sm text-muted-foreground">
                Reviews usually take up to 48 hours. We&apos;ll notify you.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {app.stage === "completed" && latest && (
        <Card>
          <CardContent className="flex items-start gap-3">
            {latest.status === "approved" ? (
              <>
                <CheckCircle2 className="mt-0.5 size-5 text-primary" />
                <div>
                  <p className="font-medium">Approved. Nice work!</p>
                  <p className="text-sm text-muted-foreground">
                    Your payout is below. See all your money on the{" "}
                    <Link href="/app/earnings" className="text-primary">
                      Earnings
                    </Link>{" "}
                    page.
                  </p>
                </div>
              </>
            ) : (
              <>
                <XCircle className="mt-0.5 size-5 text-destructive" />
                <div>
                  <p className="font-medium">This work wasn&apos;t approved</p>
                  <p className="text-sm text-muted-foreground">See the reviewer note below.</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Your submissions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {history.map((s) => (
              <SubmissionCard
                key={s.id}
                submission={s}
                payout={s.payout}
                fileUrls={fileUrls}
                unitLabel={job.pay_type === "per_unit" ? job.unit_label : null}
              />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
