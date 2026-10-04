import { ArrowLeft, CheckCircle2, Clock, PencilLine, XCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { CompanyLogo } from "@/components/company-logo";
import { SubmissionCard } from "@/components/submission-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FreelancerReviewForm } from "@/components/reviews/review-forms";

import { BriefUpdateBanner } from "./brief-update-banner";
import { ConfirmOrDispute, ReportOffPlatform } from "./confirm-payment";
import { SourceAssets } from "./source-assets";
import { requireUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/datetime";
import { formatPay, formatPayCap } from "@/lib/money";
import { getMyApplication } from "@/lib/my-jobs";
import { getMyReviewedApplications } from "@/lib/reviews";
import { signSubmissionFiles } from "@/lib/submission-files";
import { createClient } from "@/lib/supabase/server";

import { SubmitWorkForm } from "./submit-work-form";

export const metadata: Metadata = { title: "My job · lockedinnn" };

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
  const isPaid = history.some((s) => s.payout?.status === "paid");
  const reviewed = isPaid ? (await getMyReviewedApplications([app.id])).has(app.id) : false;

  // Payment request drives the confirm/dispute step (talent can read their own).
  const supabase = await createClient();
  const { data: pr } = await supabase
    .from("payment_requests")
    .select("status, talent_response, company_marked_paid_at")
    .eq("application_id", app.id)
    .maybeSingle();

  // Has the brief changed since acceptance? (job_brief_versions row newer than
  // the one this application last acknowledged.)
  const { data: latestBrief } = await supabase
    .from("job_brief_versions")
    .select("id")
    .eq("job_id", job.id)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const briefNeedsAck = !!latestBrief && latestBrief.id !== app.brief_version_id;

  // Source assets the company provided — visible only to this accepted talent
  // (RLS also enforces this at the row level).
  const { data: sourceAssets } = await supabase
    .from("job_assets")
    .select("id, kind, label, url, domain, storage_path")
    .eq("job_id", job.id)
    .eq("role", "source")
    .is("deleted_at", null);
  const filePaths = (sourceAssets ?? [])
    .filter((a) => a.kind === "file" && a.storage_path)
    .map((a) => a.storage_path as string);
  const assetUrls = new Map<string, string>();
  if (filePaths.length) {
    const { data } = await supabase.storage.from("job-assets").createSignedUrls(filePaths, 3600);
    for (const it of data ?? []) if (it.path && it.signedUrl) assetUrls.set(it.path, it.signedUrl);
  }
  const sourceAssetsWithUrls = (sourceAssets ?? []).map((a) => ({
    ...a,
    signedUrl: a.storage_path ? assetUrls.get(a.storage_path) : undefined,
  }));

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link
        href="/app/my-jobs"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> My Jobs
      </Link>

      {briefNeedsAck && <BriefUpdateBanner applicationId={app.id} />}

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
          {sourceAssetsWithUrls.length > 0 && (
            <div className="space-y-2 pt-1">
              <p className="text-xs font-medium text-muted-foreground">Source files from the company</p>
              <SourceAssets jobId={job.id} assets={sourceAssetsWithUrls} />
            </div>
          )}
          <div>
            <ReportOffPlatform applicationId={app.id} />
          </div>
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
              <div className="rounded-lg bg-warning/10 p-3 text-sm">
                <p className="mb-1 text-xs font-medium text-warning">Changes requested</p>
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
                  <p className="font-medium">Approved. Nice work.</p>
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

      {latest?.status === "approved" &&
        latest.payout?.status === "owed" &&
        !latest.payment_confirmed_by_talent && (
          <Card>
            <CardHeader>
              <CardTitle>Got paid?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {pr?.talent_response === "disputed" ? (
                <p className="text-sm text-muted-foreground">
                  You reported not receiving this payment. An admin is reviewing it — your files
                  stay locked until it&apos;s resolved.
                </p>
              ) : pr?.company_marked_paid_at ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    The company reported paying you by Juice. Check your account, then confirm — that
                    unlocks your files for them and marks the job paid. If you can&apos;t find it,
                    say so and an admin will step in.
                  </p>
                  <ConfirmOrDispute submissionId={latest.id} applicationId={app.id} />
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Waiting for the company to pay you by Juice and report it. You&apos;ll confirm here
                  once they do.
                </p>
              )}
            </CardContent>
          </Card>
        )}

      {isPaid && !reviewed && (
        <Card>
          <CardHeader>
            <CardTitle>Rate this company</CardTitle>
          </CardHeader>
          <CardContent>
            <FreelancerReviewForm applicationId={app.id} revalidate={`/app/my-jobs/${app.id}`} />
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
