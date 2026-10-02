import { Banknote, FileText } from "lucide-react";
import type { Metadata } from "next";

import { PersonLine } from "@/components/admin/person-line";
import { PageHeader } from "@/components/page-header";
import { FilterChips } from "@/components/talent/filter-chips";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getPeople } from "@/lib/admin-people";
import { formatDateTime } from "@/lib/datetime";
import { formatCents } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

import { ReviewForm } from "../course-payments/review-form";
import { reviewProductPurchase } from "./actions";

export const metadata: Metadata = { title: "Product payments · Admin · lockedinnn" };

const TABS = [
  { value: "pending", label: "To verify" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "all", label: "All" },
] as const;

export default async function AdminProductPaymentsPage({
  searchParams,
}: PageProps<"/admin/product-payments">) {
  const params = await searchParams;
  const tab = TABS.find((t) => t.value === params.status)?.value ?? "pending";

  const supabase = await createClient();
  let query = supabase
    .from("product_purchases")
    .select("*, product:products(title)")
    .order("created_at", { ascending: tab === "pending" })
    .limit(100);
  if (tab !== "all") query = query.eq("status", tab);

  const [{ data: purchases }, { count: toVerify }] = await Promise.all([
    query,
    supabase
      .from("product_purchases")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
  ]);
  const list = purchases ?? [];
  const people = await getPeople(list.map((p) => p.user_id));

  const proofPaths = list.map((p) => p.proof_path).filter((p): p is string => !!p);
  const proofUrls = new Map<string, string>();
  if (proofPaths.length) {
    const { data } = await supabase.storage
      .from("payment-proofs")
      .createSignedUrls(proofPaths, 60 * 60);
    for (const it of data ?? []) if (it.path && it.signedUrl) proofUrls.set(it.path, it.signedUrl);
  }

  return (
    <>
      <PageHeader
        title="Product payments"
        description="Verify proof of payment, then unlock the download. Target: within 24 hours."
      />

      <div className="mb-5">
        <FilterChips
          label="Payment status"
          options={TABS.map((t) => ({
            label: t.value === "pending" && toVerify ? `To verify (${toVerify})` : t.label,
            href: `/admin/product-payments?status=${t.value}`,
            active: tab === t.value,
          }))}
        />
      </div>

      {!list.length ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Banknote className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {tab === "pending" ? "No payments waiting." : "Nothing here yet."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {list.map((p) => (
            <Card key={p.id}>
              <CardContent className="grid gap-4 md:grid-cols-[1fr_minmax(0,20rem)]">
                <div className="min-w-0 space-y-3">
                  <PersonLine person={people.get(p.user_id)} />
                  <p className="text-sm">
                    <span className="font-medium">{p.product?.title}</span>
                    <span className="text-muted-foreground">
                      {" "}
                      · {formatCents(p.amount_cents ?? 0)}
                    </span>
                  </p>
                  {p.proof_path && proofUrls.get(p.proof_path) && (
                    <a
                      href={proofUrls.get(p.proof_path)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm text-primary"
                    >
                      <FileText className="size-3.5" /> View proof of payment
                    </a>
                  )}
                  {p.reference && (
                    <p className="text-sm">
                      <span className="text-muted-foreground">Reference:</span> {p.reference}
                    </p>
                  )}
                  {p.note && (
                    <p className="text-sm whitespace-pre-line text-muted-foreground">{p.note}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Submitted {formatDateTime(p.created_at)}
                  </p>
                </div>
                <div>
                  {p.status === "pending" ? (
                    <ReviewForm purchaseId={p.id} action={reviewProductPurchase.bind(null, p.id)} />
                  ) : (
                    <div className="space-y-2 text-sm">
                      <Badge
                        className={
                          p.status === "approved"
                            ? "border-0 bg-primary/15 text-primary"
                            : "border-0 bg-destructive/15 text-destructive"
                        }
                      >
                        {p.status === "approved" ? "Approved" : "Rejected"}
                      </Badge>
                      {p.reviewer_note && (
                        <p className="whitespace-pre-line text-muted-foreground">
                          {p.reviewer_note}
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
