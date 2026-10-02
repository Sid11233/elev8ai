import { Banknote } from "lucide-react";
import type { Metadata } from "next";

import { MarkPaidForm } from "@/app/admin/payouts/mark-paid-form";
import { PersonLine } from "@/components/admin/person-line";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { getPeople } from "@/lib/admin-people";
import { requireCompany } from "@/lib/auth";
import { formatCents } from "@/lib/money";
import { payoutMethodLabel, summarizePayoutDetails } from "@/lib/payout-methods";
import { createClient } from "@/lib/supabase/server";

import { markPayoutsPaid } from "./actions";

export const metadata: Metadata = { title: "Payouts · Company · lockedinnn" };

const SELECT = "*, submission:submissions(application:applications(job:jobs(title)))";

export default async function CompanyPayoutsPage() {
  await requireCompany();
  const supabase = await createClient();
  const { data: owed } = await supabase
    .from("payouts")
    .select(SELECT)
    .eq("status", "owed")
    .order("created_at");
  const owedList = owed ?? [];
  const people = await getPeople(owedList.map((p) => p.user_id));

  const detailsByUser = new Map<string, { method: string; details: Record<string, unknown> }>();
  const owedUserIds = [...new Set(owedList.map((p) => p.user_id))];
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

  const groups = [...Map.groupBy(owedList, (p) => p.user_id).entries()]
    .map(([userId, payouts]) => ({
      userId,
      payouts,
      total: payouts.reduce((sum, p) => sum + p.amount_cents, 0),
    }))
    .sort((a, b) => b.total - a.total);
  const totalOwed = groups.reduce((sum, g) => sum + g.total, 0);

  return (
    <>
      <PageHeader
        title="Payouts"
        description={`${formatCents(totalOwed)} owed. Pay by Juice/bank, then send proof in the job chat and mark it paid.`}
      />
      {groups.length ? (
        <div className="space-y-3">
          {groups.map((g) => (
            <Card key={g.userId}>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <PersonLine person={people.get(g.userId)} />
                  <p className="text-xl font-semibold text-primary tabular-nums">
                    {formatCents(g.total)}
                  </p>
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
                    <p className="text-xs text-warning">
                      No payout details yet — ask them to add them before paying.
                    </p>
                  );
                })()}
                <MarkPaidForm
                  action={markPayoutsPaid}
                  payouts={g.payouts.map((p) => ({
                    id: p.id,
                    amount_cents: p.amount_cents,
                    created_at: p.created_at,
                    jobTitle: p.submission?.application?.job?.title ?? "Job",
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
    </>
  );
}
