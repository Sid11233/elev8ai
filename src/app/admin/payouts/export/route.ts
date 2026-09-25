import type { NextRequest } from "next/server";

import { getPeople } from "@/lib/admin-people";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Quote a CSV cell, and defuse spreadsheet formulas (=, +, -, @) in user text.
function cell(value: string | number | null | undefined) {
  let text = value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

// CSV of payouts for bookkeeping. ?status=owed|paid|all
export async function GET(request: NextRequest) {
  const profile = await getCurrentProfile();
  if (profile?.role !== "admin") return new Response("Not found", { status: 404 });

  const status = request.nextUrl.searchParams.get("status");
  const supabase = await createClient();
  let query = supabase
    .from("payouts")
    .select(
      "*, submission:submissions(application:applications(job:jobs(title, company:companies(name))))",
    )
    .order("created_at");
  if (status === "owed" || status === "paid") query = query.eq("status", status);
  const { data: payouts } = await query;

  const list = payouts ?? [];
  const people = await getPeople(list.map((p) => p.user_id));
  const header = [
    "payout_id",
    "name",
    "username",
    "country",
    "job",
    "company",
    "amount_usd",
    "amount_cents",
    "status",
    "approved_at",
    "paid_at",
    "method",
    "reference",
  ];
  const rows = list.map((p) => {
    const person = people.get(p.user_id);
    const job = p.submission?.application?.job;
    return [
      p.id,
      person?.full_name,
      person?.username,
      person?.country,
      job?.title,
      job?.company?.name,
      `${Math.trunc(p.amount_cents / 100)}.${String(p.amount_cents % 100).padStart(2, "0")}`,
      p.amount_cents,
      p.status,
      p.created_at,
      p.paid_at,
      p.method,
      p.reference,
    ].map(cell);
  });

  const csv = [header.map(cell), ...rows].map((r) => r.join(",")).join("\r\n");
  const date = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="elev8ai-payouts-${status ?? "all"}-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
