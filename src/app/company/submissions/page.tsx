import { FileCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ReviewForm } from "@/app/admin/submissions/review-form";
import { PersonLine } from "@/components/admin/person-line";
import { PageHeader } from "@/components/page-header";
import { SubmissionCard } from "@/components/submission-card";
import { FilterChips } from "@/components/talent/filter-chips";
import { Card, CardContent } from "@/components/ui/card";
import { getPeople } from "@/lib/admin-people";
import { requireCompany } from "@/lib/auth";
import { formatPay } from "@/lib/money";
import { signSubmissionFiles } from "@/lib/submission-files";
import { createClient } from "@/lib/supabase/server";

import { reviewSubmission } from "./actions";

export const metadata: Metadata = { title: "Submissions · Company · Elev8ai" };

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
  const [people, fileUrls] = await Promise.all([
    getPeople(list.map((s) => s.user_id)),
    signSubmissionFiles(list.flatMap((s) => s.file_paths)),
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
                    />
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
