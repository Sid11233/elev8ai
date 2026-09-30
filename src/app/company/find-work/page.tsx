import { CalendarClock, Search, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { CompanyLogo } from "@/components/company-logo";
import { PageHeader } from "@/components/page-header";
import { FilterChips } from "@/components/talent/filter-chips";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { requireCompany } from "@/lib/auth";
import { formatDate } from "@/lib/datetime";
import { spotsLeft } from "@/lib/job-board";
import { CATEGORY_LABELS, categoryLabel, isJobCategory, JOB_CATEGORIES } from "@/lib/jobs";
import { formatPay } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Find work · Company · Elev8ai" };

const JOB_SELECT = "*, company:companies(id, name, logo_url)";

export default async function CompanyFindWorkPage({
  searchParams,
}: PageProps<"/company/find-work">) {
  const { company } = await requireCompany();
  const params = await searchParams;
  const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");
  const category = isJobCategory(one(params.category)) ? one(params.category) : "";

  const supabase = await createClient();
  const now = new Date().toISOString();
  let query = supabase
    .from("jobs")
    .select(JOB_SELECT)
    .eq("status", "open")
    .neq("company_id", company.id)
    .or(`deadline.is.null,deadline.gt.${now}`)
    .order("published_at", { ascending: false })
    .limit(100);
  if (category) query = query.eq("category", category);
  const { data: jobs } = await query;
  // Only jobs posted by another company (skip admin-owned marketplace jobs).
  const list = (jobs ?? []).filter((j) => j.company?.id && j.company.id !== company.id);

  return (
    <>
      <PageHeader
        title="Find work"
        description="Open jobs posted by other companies. Apply to win the work — they'll see your company profile."
      />
      <div className="mb-5">
        <FilterChips
          label="Category"
          options={[
            { label: "All", href: "/company/find-work", active: !category },
            ...JOB_CATEGORIES.map((c) => ({
              label: CATEGORY_LABELS[c],
              href: `/company/find-work?category=${c}`,
              active: category === c,
            })),
          ]}
        />
      </div>

      {!list.length ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Search className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No open jobs from other companies right now.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {list.map((job) => (
            <Card key={job.id} className="relative transition-colors hover:border-primary/40">
              <CardContent className="space-y-3">
                <div className="flex items-start gap-3">
                  <CompanyLogo
                    name={job.company?.name ?? "?"}
                    src={job.company?.logo_url ?? null}
                  />
                  <div className="min-w-0 flex-1">
                    <h2 className="leading-snug font-semibold">
                      <Link
                        href={`/company/find-work/${job.id}`}
                        className="after:absolute after:inset-0"
                      >
                        {job.title}
                      </Link>
                    </h2>
                    <p className="text-sm text-muted-foreground">{job.company?.name}</p>
                  </div>
                </div>
                <p className="text-lg font-semibold text-primary">{formatPay(job)}</p>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                  <Badge variant="secondary">{categoryLabel(job.category)}</Badge>
                  <span className="inline-flex items-center gap-1">
                    <Users className="size-3.5" />
                    {spotsLeft(job)} {spotsLeft(job) === 1 ? "spot" : "spots"} left
                  </span>
                  {job.deadline && (
                    <span className="inline-flex items-center gap-1">
                      <CalendarClock className="size-3.5" />
                      Due {formatDate(job.deadline)}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
