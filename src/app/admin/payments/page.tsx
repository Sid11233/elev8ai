import { Banknote, FileText } from "lucide-react";
import type { Metadata } from "next";

import { PersonLine } from "@/components/admin/person-line";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getPeople } from "@/lib/admin-people";
import { requireAdmin } from "@/lib/auth";
import { formatCents } from "@/lib/money";
import { formatDateTime } from "@/lib/datetime";
import { createClient } from "@/lib/supabase/server";

import { PaymentExceptionActions } from "./payment-actions";

export const metadata: Metadata = { title: "Payments · Admin · lockedinnn" };

export default async function AdminPaymentsPage() {
  await requireAdmin();
  const supabase = await createClient();

  // Exceptions queue: reported-but-unresolved payments (disputed, awaiting a
  // statement, or just waiting on the talent).
  const { data: requests } = await supabase
    .from("payment_requests")
    .select(
      "*, application:applications(id, user_id, job:jobs(title, company:companies(name, owner_id)))",
    )
    .is("resolution", null)
    .not("company_marked_paid_at", "is", null)
    .order("company_marked_paid_at");
  const list = requests ?? [];
  const people = await getPeople(list.map((r) => r.application?.user_id).filter((x): x is string => !!x));

  const proofPaths = list.map((r) => r.company_proof_path).filter((p): p is string => !!p);
  const proofUrls = new Map<string, string>();
  if (proofPaths.length) {
    const { data } = await supabase.storage.from("payment-proofs").createSignedUrls(proofPaths, 3600);
    for (const it of data ?? []) if (it.path && it.signedUrl) proofUrls.set(it.path, it.signedUrl);
  }

  return (
    <>
      <PageHeader
        title="Payments"
        description="Reported payments awaiting resolution. Verify proof before releasing a file."
      />

      {!list.length ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Banknote className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No payments need attention.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {list.map((r) => {
            const job = r.application?.job;
            const disputed = r.talent_response === "disputed";
            return (
              <Card key={r.id}>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <PersonLine person={people.get(r.application?.user_id ?? "")} />
                    <Badge
                      className={
                        disputed
                          ? "border-0 bg-destructive/15 text-destructive"
                          : r.status === "awaiting_statement"
                            ? "border-0 bg-warning/15 text-warning"
                            : "border-0 bg-secondary text-muted-foreground"
                      }
                    >
                      {disputed
                        ? "Talent disputed"
                        : r.status === "awaiting_statement"
                          ? "Awaiting statement"
                          : "Awaiting talent"}
                    </Badge>
                  </div>

                  <p className="text-sm">
                    <span className="font-medium">{job?.title ?? "Job"}</span>
                    <span className="text-muted-foreground">
                      {" "}
                      · {job?.company?.name} · {formatCents(r.amount_cents)} · {r.reference_code}
                    </span>
                  </p>

                  <div className="grid gap-1 text-sm sm:grid-cols-2">
                    <p>
                      <span className="text-muted-foreground">Txn id:</span>{" "}
                      {r.company_txn_id ?? "—"}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Reported:</span>{" "}
                      {r.company_marked_paid_at ? formatDateTime(r.company_marked_paid_at) : "—"}
                    </p>
                    {disputed && r.talent_txn_id_entered && (
                      <p>
                        <span className="text-muted-foreground">Talent&apos;s txn:</span>{" "}
                        {r.talent_txn_id_entered}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-4 text-sm">
                    {r.company_proof_path && proofUrls.get(r.company_proof_path) && (
                      <a
                        href={proofUrls.get(r.company_proof_path)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-primary"
                      >
                        <FileText className="size-3.5" /> Company proof
                      </a>
                    )}
                    {r.statement_path && proofUrls.get(r.statement_path) && (
                      <a
                        href={proofUrls.get(r.statement_path)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-primary"
                      >
                        <FileText className="size-3.5" /> Bank statement
                      </a>
                    )}
                  </div>

                  <PaymentExceptionActions
                    requestId={r.id}
                    talentId={r.application?.user_id ?? ""}
                    companyOwnerId={job?.company?.owner_id ?? null}
                  />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
