import { ExternalLink, FileText, Inbox } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { DecisionForm } from "@/app/admin/applications/decision-form";
import { PersonLine } from "@/components/admin/person-line";
import { ApplicantCompanyLine } from "@/components/company/applicant-company-line";
import { PageHeader } from "@/components/page-header";
import { FilterChips } from "@/components/talent/filter-chips";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ProviderReviewForm } from "@/components/reviews/review-forms";
import { StarRating } from "@/components/reviews/star-rating";
import { getPeople } from "@/lib/admin-people";
import { getApplicantCompanies } from "@/lib/applicant-companies";
import { requireCompany } from "@/lib/auth";
import {
  getFreelancerRatings,
  getMyReviewedApplications,
  getPaidApplications,
} from "@/lib/reviews";
import { formatDateTime } from "@/lib/datetime";
import { formatPay } from "@/lib/money";
import { displayFileName } from "@/lib/submission-files";
import { createClient } from "@/lib/supabase/server";

import { decideApplication } from "./actions";

export const metadata: Metadata = { title: "Applications · Company · lockedinnn" };

const TABS = [
  { value: "pending", label: "Pending" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
  { value: "all", label: "All" },
] as const;

export default async function CompanyApplicationsPage({
  searchParams,
}: PageProps<"/company/applications">) {
  await requireCompany();
  const params = await searchParams;
  const tab = TABS.find((t) => t.value === params.status)?.value ?? "pending";

  const supabase = await createClient();
  let query = supabase
    .from("applications")
    .select(
      "*, job:jobs(id, title, slots, spots_taken, pay_cents, pay_type, unit_label, max_units)",
    )
    .order("created_at", { ascending: tab === "pending" })
    .limit(200);
  if (tab !== "all") query = query.eq("status", tab);
  const { data: applications } = await query;

  const list = applications ?? [];
  const acceptedIds = list.filter((a) => a.status === "accepted").map((a) => a.id);
  const [people, companies, ratings, paid, reviewed] = await Promise.all([
    getPeople(list.map((a) => a.user_id)),
    getApplicantCompanies(list.map((a) => a.user_id)),
    getFreelancerRatings(list.map((a) => a.user_id)),
    getPaidApplications(acceptedIds),
    getMyReviewedApplications(acceptedIds),
  ]);
  const attachmentPaths = list.flatMap((a) => a.file_paths);
  const fileUrls = new Map<string, string>();
  if (attachmentPaths.length) {
    const { data } = await supabase.storage
      .from("application-attachments")
      .createSignedUrls(attachmentPaths, 60 * 60);
    for (const it of data ?? []) if (it.path && it.signedUrl) fileUrls.set(it.path, it.signedUrl);
  }

  return (
    <>
      <PageHeader title="Applications" description="Review people who applied to your jobs." />
      <div className="mb-5">
        <FilterChips
          label="Application status"
          options={TABS.map((t) => ({
            label: t.label,
            href: `/company/applications?status=${t.value}`,
            active: tab === t.value,
          }))}
        />
      </div>

      {!list.length ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Inbox className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Nothing here yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {list.map((app) => (
            <Card key={app.id}>
              <CardContent className="grid gap-4 md:grid-cols-[1fr_minmax(0,22rem)]">
                <div className="min-w-0 space-y-3">
                  {companies.get(app.user_id) ? (
                    <ApplicantCompanyLine company={companies.get(app.user_id)!} />
                  ) : (
                    <>
                      <PersonLine person={people.get(app.user_id)} />
                      {ratings.get(app.user_id) && (
                        <StarRating
                          avg={ratings.get(app.user_id)!.avg}
                          count={ratings.get(app.user_id)!.count}
                        />
                      )}
                      <Link
                        href={`/company/applicants/${app.user_id}`}
                        className="text-sm font-medium text-primary"
                      >
                        View profile →
                      </Link>
                      {people.get(app.user_id)?.about && (
                        <p className="text-sm whitespace-pre-line text-muted-foreground">
                          {people.get(app.user_id)?.about}
                        </p>
                      )}
                    </>
                  )}
                  {app.job && (
                    <p className="text-sm">
                      <Link
                        href={`/company/jobs/${app.job.id}`}
                        className="font-medium hover:underline"
                      >
                        {app.job.title}
                      </Link>
                      <span className="text-muted-foreground">
                        {" "}
                        · {formatPay(app.job)} · {app.job.spots_taken}/{app.job.slots} spots filled
                      </span>
                    </p>
                  )}
                  {app.pitch ? (
                    <p className="rounded-lg bg-secondary/50 p-3 text-sm whitespace-pre-line">
                      {app.pitch}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">No pitch</p>
                  )}
                  {app.links.map((link) => (
                    <a
                      key={link}
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex max-w-full items-center gap-1.5 text-sm text-primary"
                    >
                      <ExternalLink className="size-3.5 shrink-0" />
                      <span className="truncate">{link}</span>
                    </a>
                  ))}
                  {app.file_paths.map((path) => (
                    <a
                      key={path}
                      href={fileUrls.get(path)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex max-w-full items-center gap-1.5 text-sm text-primary"
                    >
                      <FileText className="size-3.5 shrink-0" />
                      <span className="truncate">{displayFileName(path)}</span>
                    </a>
                  ))}
                  <p className="text-xs text-muted-foreground">
                    Applied {formatDateTime(app.created_at)}
                  </p>
                </div>

                <div>
                  {app.status === "pending" ? (
                    <DecisionForm
                      applicationId={app.id}
                      action={decideApplication.bind(null, app.id)}
                    />
                  ) : (
                    <div className="space-y-2 text-sm">
                      <Badge
                        className={
                          app.status === "accepted"
                            ? "border-0 bg-primary/15 text-primary"
                            : "border-0 bg-secondary text-muted-foreground"
                        }
                      >
                        {app.status[0].toUpperCase() + app.status.slice(1)}
                      </Badge>
                      {app.decision_note && (
                        <p className="whitespace-pre-line text-muted-foreground">
                          {app.decision_note}
                        </p>
                      )}
                      {app.status === "accepted" &&
                        paid.has(app.id) &&
                        !reviewed.has(app.id) &&
                        !companies.get(app.user_id) && (
                          <ProviderReviewForm
                            applicationId={app.id}
                            revalidate="/company/applications"
                          />
                        )}
                    </div>
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
