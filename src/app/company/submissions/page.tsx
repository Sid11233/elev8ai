import { FileCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ReviewForm } from "@/app/admin/submissions/review-form";
import { PersonLine } from "@/components/admin/person-line";
import { PageHeader } from "@/components/page-header";
import { SubmissionCard } from "@/components/submission-card";
import { FilterChips } from "@/components/talent/filter-chips";
import { Card, CardContent } from "@/components/ui/card";
import { PaymentQrPanel } from "@/components/payments/payment-qr-panel";
import { getPeople } from "@/lib/admin-people";
import { requireCompany } from "@/lib/auth";
import { formatPay } from "@/lib/money";
import { getPaymentRequests } from "@/lib/payment-request";
import { signCleanFilesAsService, signPreviewFiles } from "@/lib/submission-files";
import { createClient } from "@/lib/supabase/server";

import { reviewSubmission } from "./actions";

export const metadata: Metadata = { title: "Submissions · Company · lockedinnn" };

const TABS = [
  { value: "submitted", label: "To review" },
  { value: "changes_requested", label: "Changes requested" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "all", label: "All" },
] as const;

export default async function CompanySubmissionsPage({
  searchParams,
}: PageProps<"/company/submissions">) {
  await requireCompany();
  const params = await searchParams;
  const tab = TABS.find((t) => t.value === params.status)?.value ?? "submitted";

  const supabase = await createClient();
  let query = supabase
    .from("submissions")
    .select(
      "*, payout:payouts(*), application:applications(id, job:jobs(id, title, pay_cents, pay_type, unit_label, max_units, proof_instructions))",
    )
    .order("created_at", { ascending: tab === "submitted" })
    .limit(100);
  if (tab !== "all") query = query.eq("status", tab);
  const { data: submissions } = await query;
  const list = submissions ?? [];

  // Staged reveal: the company sees watermarked previews until the freelancer
  // confirms payment; clean files are signed with the service role only then.
  const confirmedCleanPaths = list
    .filter((s) => s.payment_confirmed_by_talent)
    .flatMap((s) => s.file_paths);
  const previewPaths = list
    .filter((s) => !s.payment_confirmed_by_talent)
    .flatMap((s) => s.preview_paths);

  const [people, cleanUrls, previewUrls, paymentRequests] = await Promise.all([
    getPeople(list.map((s) => s.user_id)),
    signCleanFilesAsService(confirmedCleanPaths),
    signPreviewFiles(previewPaths),
    getPaymentRequests(list.map((s) => s.application?.id).filter((id): id is string => !!id)),
  ]);

  return (
    <>
      <PageHeader title="Submissions" description="Review proof of work on your jobs." />
      <div className="mb-5">
        <FilterChips
          label="Submission status"
          options={TABS.map((t) => ({
            label: t.label,
            href: `/company/submissions?status=${t.value}`,
            active: tab === t.value,
          }))}
        />
      </div>

      {!list.length ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <FileCheck className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Nothing here yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {list.map((s) => {
            const job = s.application?.job;
            const unitLabel = job?.pay_type === "per_unit" ? job.unit_label : null;
            const confirmed = s.payment_confirmed_by_talent;
            const files = confirmed ? s.file_paths : s.preview_paths;
            const fileUrls = confirmed ? cleanUrls : previewUrls;
            const fileHint =
              confirmed || s.file_paths.length === 0
                ? undefined
                : s.preview_paths.length > 0
                  ? "Watermarked preview. Clean files unlock once you pay and the freelancer confirms receipt."
                  : "Files unlock once you pay and the freelancer confirms receipt.";
            const owedPayout = s.payout?.status === "owed";
            const pr = s.application?.id ? paymentRequests.get(s.application.id) : undefined;
            const username = people.get(s.user_id)?.username;
            return (
              <Card key={s.id}>
                <CardContent className="grid gap-4 md:grid-cols-[1fr_minmax(0,20rem)]">
                  <div className="min-w-0 space-y-3">
                    <PersonLine person={people.get(s.user_id)} />
                    {job && (
                      <p className="text-sm">
                        <Link
                          href={`/company/jobs/${job.id}`}
                          className="font-medium hover:underline"
                        >
                          {job.title}
                        </Link>
                        <span className="text-muted-foreground"> · {formatPay(job)}</span>
                      </p>
                    )}
                    <SubmissionCard
                      submission={s}
                      payout={s.payout}
                      fileUrls={fileUrls}
                      unitLabel={unitLabel}
                      files={files}
                      fileHint={fileHint}
                    />
                    {s.status === "approved" && owedPayout && pr && username ? (
                      <PaymentQrPanel
                        username={username}
                        token={pr.token}
                        referenceCode={pr.referenceCode}
                        amountCents={s.payout?.amount_cents ?? 0}
                      />
                    ) : s.status === "approved" && owedPayout ? (
                      <p className="text-xs text-warning">Generating the payment link…</p>
                    ) : null}
                    {s.status === "approved" && confirmed && (
                      <p className="text-sm text-success">Payment confirmed by the freelancer.</p>
                    )}
                  </div>
                  {s.status === "submitted" && job && (
                    <ReviewForm
                      submissionId={s.id}
                      payCents={job.pay_cents}
                      unitLabel={unitLabel}
                      maxUnits={job.max_units}
                      unitsClaimed={s.units_claimed}
                      action={reviewSubmission.bind(null, s.id)}
                    />
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
