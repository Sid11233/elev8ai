import { FileCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PersonLine } from "@/components/admin/person-line";
import { PageHeader } from "@/components/page-header";
import { SubmissionCard } from "@/components/submission-card";
import { FilterChips } from "@/components/talent/filter-chips";
import { Card, CardContent } from "@/components/ui/card";
import { PaymentQrPanel } from "@/components/payments/payment-qr-panel";
import { ReportPaymentForm } from "@/components/payments/report-payment-form";
import { getPeople } from "@/lib/admin-people";
import { getCurrentUser } from "@/lib/auth";
import { formatPay } from "@/lib/money";
import { getPaymentRequests } from "@/lib/payment-request";
import { signCleanFilesAsService, signPreviewFiles } from "@/lib/submission-files";
import { createClient } from "@/lib/supabase/server";

import { ReviewForm } from "./review-form";

export const metadata: Metadata = { title: "Submissions · Admin · lockedinnn" };

const TABS = [
  { value: "submitted", label: "To review" },
  { value: "changes_requested", label: "Changes requested" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "all", label: "All" },
] as const;

export default async function AdminSubmissionsPage({
  searchParams,
}: PageProps<"/admin/submissions">) {
  const params = await searchParams;
  const tab = TABS.find((t) => t.value === params.status)?.value ?? "submitted";

  const supabase = await createClient();
  const me = await getCurrentUser();
  let query = supabase
    .from("submissions")
    .select(
      "*, payout:payouts(*), application:applications(id, job:jobs(id, title, pay_cents, pay_type, unit_label, max_units, proof_instructions, company:companies(name)))",
    )
    .order("created_at", { ascending: tab === "submitted" })
    .limit(100);
  if (tab !== "all") query = query.eq("status", tab);

  const [{ data: submissions }, { count: toReview }] = await Promise.all([
    query,
    supabase
      .from("submissions")
      .select("id", { count: "exact", head: true })
      .eq("status", "submitted"),
  ]);
  const list = submissions ?? [];

  // Staged reveal: watermarked previews until the freelancer confirms payment,
  // then clean files. Admin acts as the provider for admin-owned companies.
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
      <PageHeader
        title="Submissions"
        description="Review proof of work. Target: within 48 hours."
      />
      <div className="mb-5">
        <FilterChips
          label="Submission status"
          options={TABS.map((t) => ({
            label: t.value === "submitted" && toReview ? `To review (${toReview})` : t.label,
            href: `/admin/submissions?status=${t.value}`,
            active: tab === t.value,
          }))}
        />
      </div>

      {!list.length ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <FileCheck className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {tab === "submitted" ? "Nothing waiting for review." : "Nothing here yet."}
            </p>
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
                          href={`/admin/jobs/${job.id}`}
                          className="font-medium hover:underline"
                        >
                          {job.title}
                        </Link>
                        <span className="text-muted-foreground">
                          {" "}
                          · {job.company?.name} · {formatPay(job)}
                        </span>
                      </p>
                    )}
                    {job?.proof_instructions && (
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium">Asked for:</span> {job.proof_instructions}
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
                    {s.status === "approved" && owedPayout && pr && username && (
                      <>
                        <PaymentQrPanel
                          username={username}
                          token={pr.token}
                          referenceCode={pr.referenceCode}
                          amountCents={s.payout?.amount_cents ?? 0}
                        />
                        {pr.status === "payment_reported" ? (
                          <p className="text-sm text-muted-foreground">
                            Payment reported. Waiting for the freelancer to confirm.
                          </p>
                        ) : me ? (
                          <ReportPaymentForm
                            submissionId={s.id}
                            reporterUserId={me.id}
                            amountCents={s.payout?.amount_cents ?? 0}
                          />
                        ) : null}
                      </>
                    )}
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
