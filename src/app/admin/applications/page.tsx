import { ExternalLink, FileText, Inbox } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

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
import {
  getFreelancerRatings,
  getMyReviewedApplications,
  getPaidApplications,
} from "@/lib/reviews";
import { formatDateTime } from "@/lib/datetime";
import { formatPay } from "@/lib/money";
import { displayFileName } from "@/lib/submission-files";
import { createClient } from "@/lib/supabase/server";

import { DecisionForm } from "./decision-form";

export const metadata: Metadata = { title: "Applications · Admin · Elev8ai" };

const TABS = [
  { value: "pending", label: "Pending" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
  { value: "all", label: "All" },
] as const;

export default async function AdminApplicationsPage({
  searchParams,
}: PageProps<"/admin/applications">) {
  const params = await searchParams;
  const tab = TABS.find((t) => t.value === params.status)?.value ?? "pending";

  const supabase = await createClient();
  let query = supabase
    .from("applications")
    .select(
      "*, job:jobs(id, title, slots, spots_taken, status, pay_cents, pay_type, unit_label, max_units, company:companies(name))",
    )
    // Oldest pending first, so nobody waits too long.
    .order("created_at", { ascending: tab === "pending" })
    .limit(200);
  if (tab !== "all") query = query.eq("status", tab);
  const [{ data: applications }, { count: pendingCount }] = await Promise.all([
    query,
    supabase
      .from("applications")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
  ]);
  const list = applications ?? [];
  const acceptedIds = list.filter((a) => a.status === "accepted").map((a) => a.id);
  const [people, companies, ratings, paid, reviewed] = await Promise.all([
    getPeople(list.map((a) => a.user_id)),
    getApplicantCompanies(list.map((a) => a.user_id)),
    getFreelancerRatings(list.map((a) => a.user_id)),
    getPaidApplications(acceptedIds),
    getMyReviewedApplications(acceptedIds),
  ]);

  // Sign the applicants' portfolio attachments (admins can read all).
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
      <PageHeader title="Applications" description="Accept or reject talent who applied to jobs." />
      <div className="mb-5">
        <FilterChips
          label="Application status"
          options={TABS.map((t) => ({
            label: t.value === "pending" && pendingCount ? `Pending (${pendingCount})` : t.label,
            href: `/admin/applications?status=${t.value}`,
            active: tab === t.value,
          }))}
        />
      </div>

      {!applications?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Inbox className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {tab === "pending" ? "No applications waiting. Nice." : "Nothing here yet."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {applications.map((app) => (
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
                        href={`/admin/jobs/${app.job.id}`}
                        className="font-medium hover:underline"
                      >
                        {app.job.title}
                      </Link>
                      <span className="text-muted-foreground">
                        {" "}
                        · {app.job.company?.name} · {formatPay(app.job)} · {app.job.spots_taken}/
                        {app.job.slots} spots filled
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
                  {app.links.length > 0 && (
                    <ul className="space-y-1">
                      {app.links.map((link) => (
                        <li key={link} className="min-w-0">
                          <a
                            href={link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex max-w-full items-center gap-1.5 text-sm text-primary"
                          >
                            <ExternalLink className="size-3.5 shrink-0" />
                            <span className="truncate">{link}</span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
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
                    <DecisionForm applicationId={app.id} />
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
                      {app.decided_at && (
                        <p className="text-xs text-muted-foreground">
                          Decided {formatDateTime(app.decided_at)}
                        </p>
                      )}
                      {app.status === "accepted" &&
                        paid.has(app.id) &&
                        !reviewed.has(app.id) &&
                        !companies.get(app.user_id) && (
                          <ProviderReviewForm
                            applicationId={app.id}
                            revalidate="/admin/applications"
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
