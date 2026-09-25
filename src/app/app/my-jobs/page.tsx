import { ClipboardList } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { CompanyLogo } from "@/components/company-logo";
import { PageHeader } from "@/components/page-header";
import { FilterChips } from "@/components/talent/filter-chips";
import { StageBadge } from "@/components/talent/stage-badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/datetime";
import { formatCents, formatPay } from "@/lib/money";
import { getMyApplications, type JobStage, STAGE_LABELS } from "@/lib/my-jobs";

export const metadata: Metadata = { title: "My Jobs · Elev8ai" };

const TABS: JobStage[] = ["applied", "in_progress", "submitted", "completed"];

const EMPTY: Record<JobStage, string> = {
  applied: "Jobs you apply to show up here while you wait for a decision.",
  in_progress: "When you're accepted for a job, it moves here until you submit your work.",
  submitted: "Work you've submitted waits here while it's reviewed.",
  completed: "Approved work and your payouts show up here.",
};

export default async function MyJobsPage({ searchParams }: PageProps<"/app/my-jobs">) {
  const params = await searchParams;
  const applications = await getMyApplications();

  const counts = Object.fromEntries(
    TABS.map((t) => [t, applications.filter((a) => a.stage === t).length]),
  ) as Record<JobStage, number>;
  // Default to the first tab that needs attention.
  const requested = TABS.find((t) => t === params.tab);
  const tab =
    requested ?? (counts.in_progress ? "in_progress" : (TABS.find((t) => counts[t]) ?? "applied"));
  const visible = applications.filter((a) => a.stage === tab);

  return (
    <>
      <PageHeader
        title="My Jobs"
        description="Jobs you've applied to, are working on, or have finished."
      >
        <Link href="/app/earnings" className="text-sm font-medium text-primary">
          Earnings →
        </Link>
      </PageHeader>

      <div className="mb-5">
        <FilterChips
          label="Job stage"
          options={TABS.map((t) => ({
            label: counts[t] ? `${STAGE_LABELS[t]} (${counts[t]})` : STAGE_LABELS[t],
            href: `/app/my-jobs?tab=${t}`,
            active: tab === t,
          }))}
        />
      </div>

      {visible.length ? (
        <div className="space-y-3">
          {visible.map((app) => {
            const job = app.job;
            if (!job) return null;
            const href =
              app.status === "accepted" ? `/app/my-jobs/${app.id}` : `/app/jobs/${job.id}`;
            const payout = app.latest?.payout;
            return (
              <Card key={app.id} className="relative transition-colors hover:border-primary/40">
                <CardContent className="flex items-start gap-3">
                  <CompanyLogo
                    name={job.company?.name ?? "?"}
                    src={job.company?.logo_url ?? null}
                  />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <Link href={href} className="font-medium after:absolute after:inset-0">
                        {job.title}
                      </Link>
                      <StageBadge app={app} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {job.company?.name} · {formatPay(job)}
                      {job.deadline && <> · due {formatDate(job.deadline)}</>}
                    </p>
                    {payout && (
                      <p className="text-sm font-medium text-primary">
                        {formatCents(payout.amount_cents)}{" "}
                        {payout.status === "paid" ? "paid" : "owed"}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <ClipboardList className="size-6" />
            </span>
            <p className="max-w-sm text-sm text-muted-foreground">{EMPTY[tab]}</p>
            <Link href="/app/jobs" className="text-sm font-medium text-primary">
              Browse jobs
            </Link>
          </CardContent>
        </Card>
      )}
    </>
  );
}
