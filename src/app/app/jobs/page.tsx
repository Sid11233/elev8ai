import { Briefcase } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { FilterChips } from "@/components/talent/filter-chips";
import { JobCard } from "@/components/talent/job-card";
import { Card, CardContent } from "@/components/ui/card";
import { requireOnboardedProfile } from "@/lib/auth";
import { getOpenJobsForTalent } from "@/lib/job-board";
import { CATEGORY_LABELS, isJobCategory, JOB_CATEGORIES } from "@/lib/jobs";
import { maxEarningsCents } from "@/lib/money";

export const metadata: Metadata = { title: "Jobs · Elev8ai" };

const MIN_PAY_OPTIONS = [
  { value: "", label: "Any pay" },
  { value: "500", label: "$5+" },
  { value: "2000", label: "$20+" },
  { value: "5000", label: "$50+" },
] as const;

const AVAILABILITY = [
  { value: "", label: "All" },
  { value: "available", label: "Can take now" },
  { value: "locked", label: "Locked" },
] as const;

type Filters = { category: string; min: string; show: string };

function hrefWith(filters: Filters, change: Partial<Filters>) {
  const next = { ...filters, ...change };
  const params = new URLSearchParams();
  if (next.category) params.set("category", next.category);
  if (next.min) params.set("min", next.min);
  if (next.show) params.set("show", next.show);
  const qs = params.toString();
  return qs ? `/app/jobs?${qs}` : "/app/jobs";
}

export default async function JobsPage({ searchParams }: PageProps<"/app/jobs">) {
  const profile = await requireOnboardedProfile();
  const params = await searchParams;
  const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

  const filters: Filters = {
    category: isJobCategory(one(params.category)) ? one(params.category) : "",
    min: MIN_PAY_OPTIONS.some((o) => o.value === one(params.min)) ? one(params.min) : "",
    show: AVAILABILITY.some((o) => o.value === one(params.show)) ? one(params.show) : "",
  };

  const { jobs } = await getOpenJobsForTalent();
  const minCents = filters.min ? Number(filters.min) : 0;
  const visible = jobs.filter(
    (job) =>
      (!filters.category || job.category === filters.category) &&
      maxEarningsCents(job) >= minCents &&
      (filters.show !== "available" || !job.locked) &&
      (filters.show !== "locked" || job.locked),
  );
  const filtered = !!(filters.category || filters.min || filters.show);

  return (
    <>
      <PageHeader
        title={`Welcome, ${profile.full_name?.split(" ")[0] ?? "there"}`}
        description="Pick a job, do the work, get paid."
      />

      <div className="mb-5 space-y-2.5">
        <FilterChips
          label="Category"
          options={[
            {
              label: "All categories",
              href: hrefWith(filters, { category: "" }),
              active: !filters.category,
            },
            ...JOB_CATEGORIES.map((c) => ({
              label: CATEGORY_LABELS[c],
              href: hrefWith(filters, { category: c }),
              active: filters.category === c,
            })),
          ]}
        />
        <FilterChips
          label="Availability"
          options={AVAILABILITY.map((o) => ({
            label: o.label,
            href: hrefWith(filters, { show: o.value }),
            active: filters.show === o.value,
          }))}
        />
        <FilterChips
          label="Minimum pay"
          options={MIN_PAY_OPTIONS.map((o) => ({
            label: o.label,
            href: hrefWith(filters, { min: o.value }),
            active: filters.min === o.value,
          }))}
        />
      </div>

      {visible.length ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Briefcase className="size-6" />
            </span>
            {filtered ? (
              <>
                <p className="text-sm text-muted-foreground">No jobs match these filters.</p>
                <Link href="/app/jobs" className="text-sm font-medium text-primary">
                  Clear filters
                </Link>
              </>
            ) : (
              <p className="max-w-sm text-sm text-muted-foreground">
                No open jobs right now. New jobs are posted every week, so check back soon.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}
