import { Inbox } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PersonLine } from "@/components/admin/person-line";
import { PageHeader } from "@/components/page-header";
import { FilterChips } from "@/components/talent/filter-chips";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getPeople } from "@/lib/admin-people";
import { formatDateTime } from "@/lib/datetime";
import { formatPay } from "@/lib/money";
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
  const people = await getPeople((applications ?? []).map((a) => a.user_id));

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
                  <PersonLine person={people.get(app.user_id)} />
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
