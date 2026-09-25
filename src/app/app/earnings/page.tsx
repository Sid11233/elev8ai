import { Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { formatDate } from "@/lib/datetime";
import { formatCents } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Earnings · Elev8ai" };

export default async function EarningsPage() {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data: payouts } = await supabase
    .from("payouts")
    .select(
      "*, submission:submissions(application:applications(id, job:jobs(title, company:companies(name))))",
    )
    .eq("user_id", user?.id ?? "")
    .order("created_at", { ascending: false });

  const list = payouts ?? [];
  const owed = list.filter((p) => p.status === "owed").reduce((sum, p) => sum + p.amount_cents, 0);
  const paid = list.filter((p) => p.status === "paid").reduce((sum, p) => sum + p.amount_cents, 0);

  const stats = [
    { label: "Owed to you", value: owed, highlight: true },
    { label: "Paid out", value: paid },
    { label: "Lifetime", value: owed + paid },
  ];

  return (
    <>
      <PageHeader
        title="Earnings"
        description="Approved work is paid every Friday for everything approved by Thursday."
      />

      <div className="mb-6 grid grid-cols-3 gap-3">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="space-y-1 px-3 sm:px-6">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p
                className={cn(
                  "text-lg font-semibold tabular-nums sm:text-2xl",
                  s.highlight && "text-primary",
                )}
              >
                {formatCents(s.value)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {list.length ? (
        <Card>
          <CardContent>
            <ul className="divide-y">
              {list.map((p) => {
                const app = p.submission?.application;
                return (
                  <li key={p.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      {app ? (
                        <Link
                          href={`/app/my-jobs/${app.id}`}
                          className="block truncate text-sm font-medium"
                        >
                          {app.job?.title}
                        </Link>
                      ) : (
                        <p className="text-sm font-medium">Payout</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {app?.job?.company?.name} · approved {formatDate(p.created_at)}
                        {p.paid_at && <> · paid {formatDate(p.paid_at)}</>}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="font-semibold tabular-nums">
                        {formatCents(p.amount_cents)}
                      </span>
                      <Badge
                        className={cn(
                          "border-0",
                          p.status === "paid"
                            ? "bg-primary/15 text-primary"
                            : "bg-secondary text-muted-foreground",
                        )}
                      >
                        {p.status === "paid" ? "Paid" : "Owed"}
                      </Badge>
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Wallet className="size-6" />
            </span>
            <p className="max-w-sm text-sm text-muted-foreground">
              No earnings yet. Finish a job and get it approved to see your first payout here.
            </p>
            <Link href="/app/jobs" className="text-sm font-medium text-primary">
              Find a job
            </Link>
          </CardContent>
        </Card>
      )}
    </>
  );
}
