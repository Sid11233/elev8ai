import { Banknote, Download } from "lucide-react";
import type { Metadata } from "next";

import { PersonLine } from "@/components/admin/person-line";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPeople } from "@/lib/admin-people";
import { formatDate } from "@/lib/datetime";
import { formatCents } from "@/lib/money";
import { payoutMethodLabel, summarizePayoutDetails } from "@/lib/payout-methods";
import { createClient } from "@/lib/supabase/server";

import { MarkPaidForm } from "./mark-paid-form";

export const metadata: Metadata = { title: "Payouts · Admin · Elev8ai" };

const PAYOUT_SELECT = "*, submission:submissions(application:applications(job:jobs(title)))";

export default async function AdminPayoutsPage() {
  const supabase = await createClient();
  const [{ data: owed }, { data: paid }] = await Promise.all([
    supabase.from("payouts").select(PAYOUT_SELECT).eq("status", "owed").order("created_at"),
    supabase
      .from("payouts")
      .select(PAYOUT_SELECT)
      .eq("status", "paid")
      .order("paid_at", { ascending: false })
      .limit(50),
  ]);

  const owedList = owed ?? [];
  const paidList = paid ?? [];
  const people = await getPeople([...owedList, ...paidList].map((p) => p.user_id));

  // Payout details for everyone owed money (readable by admins via RLS).
  const owedUserIds = [...new Set(owedList.map((p) => p.user_id))];
  const detailsByUser = new Map<string, { method: string; details: Record<string, unknown> }>();
  if (owedUserIds.length) {
    const { data: pds } = await supabase
      .from("payout_details")
      .select("user_id, method, details")
      .in("user_id", owedUserIds);
    for (const d of pds ?? [])
      detailsByUser.set(d.user_id, {
        method: d.method,
        details: (d.details as Record<string, unknown>) ?? {},
      });
  }

  // Group owed payouts by person, biggest balance first.
  const groups = [...Map.groupBy(owedList, (p) => p.user_id).entries()]
    .map(([userId, payouts]) => ({
      userId,
      payouts,
      total: payouts.reduce((sum, p) => sum + p.amount_cents, 0),
    }))
    .sort((a, b) => b.total - a.total);
  const totalOwed = groups.reduce((sum, g) => sum + g.total, 0);
  const jobTitle = (p: (typeof owedList)[number]) => p.submission?.application?.job?.title ?? "Job";

  return (
    <>
      <PageHeader
        title="Payouts"
        description={`${formatCents(totalOwed)} owed to ${groups.length} ${groups.length === 1 ? "person" : "people"}. Pay every Friday; minimum payout $10.`}
      >
        <Button asChild variant="outline" className="h-10">
          <a href="/admin/payouts/export?status=owed">
            <Download className="size-4" /> Owed CSV
          </a>
        </Button>
        <Button asChild variant="outline" className="h-10">
          <a href="/admin/payouts/export?status=all">
            <Download className="size-4" /> All CSV
          </a>
        </Button>
      </PageHeader>

      {groups.length ? (
        <div className="space-y-3">
          {groups.map((g) => (
            <Card key={g.userId}>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <PersonLine person={people.get(g.userId)} />
                  <div className="text-right">
                    <p className="text-xl font-semibold text-primary tabular-nums">
                      {formatCents(g.total)}
                    </p>
                    {g.total < 1000 && (
                      <p className="text-xs text-muted-foreground">Below the $10 minimum</p>
                    )}
                  </div>
                </div>
                {(() => {
                  const pd = detailsByUser.get(g.userId);
                  return pd ? (
                    <p className="rounded-lg bg-secondary/50 px-3 py-2 text-sm">
                      <span className="font-medium">{payoutMethodLabel(pd.method)}:</span>{" "}
                      <span className="text-muted-foreground">
                        {summarizePayoutDetails(pd.method, pd.details) || "—"}
                      </span>
                    </p>
                  ) : (
                    <p className="text-xs text-amber-300">
                      No payout details yet — ask them to add them before paying.
                    </p>
                  );
                })()}
                <MarkPaidForm
                  payouts={g.payouts.map((p) => ({
                    id: p.id,
                    amount_cents: p.amount_cents,
                    created_at: p.created_at,
                    jobTitle: jobTitle(p),
                  }))}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Banknote className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Nobody is owed anything right now.</p>
          </CardContent>
        </Card>
      )}

      {paidList.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Recently paid</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {paidList.map((p) => {
                const person = people.get(p.user_id);
                return (
                  <li key={p.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {person?.full_name ?? "Unknown"}{" "}
                        <span className="font-normal text-muted-foreground">
                          · {p.submission?.application?.job?.title}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {p.paid_at && formatDate(p.paid_at)} · {p.method}
                        {p.reference && <> · {p.reference}</>}
                      </p>
                    </div>
                    <span className="shrink-0 font-medium tabular-nums">
                      {formatCents(p.amount_cents)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </>
  );
}
