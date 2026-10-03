import "server-only";

import QRCode from "qrcode";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Which stored payout field is the "account" shown (masked) on the pay page.
const PRIMARY_FIELD: Record<string, string> = {
  juice: "phone",
  bank: "account_number",
  wise: "email",
  paypal: "email",
};

const METHOD_LABEL: Record<string, string> = {
  juice: "MCB Juice",
  bank: "Bank transfer",
  wise: "Wise",
  paypal: "PayPal",
};

export function methodLabel(method: string) {
  return METHOD_LABEL[method] ?? method;
}

// "123456789" -> "****6789"; short values are masked whole.
export function maskTail(value: string) {
  const v = value.trim();
  if (v.length <= 4) return "****";
  return `****${v.slice(-4)}`;
}

export function paymentUrl(username: string, token: string) {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/p/${encodeURIComponent(username)}/${token}`;
}

// Fresh QR data-URI generated server-side each render (never stored/cached).
export async function qrDataUri(url: string): Promise<string> {
  return QRCode.toDataURL(url, { margin: 1, width: 320, errorCorrectionLevel: "M" });
}

export type InAppPaymentRequest = {
  applicationId: string;
  token: string;
  referenceCode: string;
  status: string;
};

// Payment requests for several applications, keyed by application id (read with
// the caller's session; RLS scopes to the job's company owner / talent / admin).
export async function getPaymentRequests(
  applicationIds: string[],
): Promise<Map<string, InAppPaymentRequest>> {
  const ids = [...new Set(applicationIds)];
  const map = new Map<string, InAppPaymentRequest>();
  if (!ids.length) return map;
  const supabase = await createClient();
  const { data } = await supabase
    .from("payment_requests")
    .select("id, application_id, reference_code, status")
    .in("application_id", ids);
  for (const r of data ?? []) {
    map.set(r.application_id, {
      applicationId: r.application_id,
      token: r.id,
      referenceCode: r.reference_code,
      status: r.status,
    });
  }
  return map;
}

// --- Public pay page (unauthenticated) -------------------------------------

// Best-effort in-process IP rate limit. The real security boundary is the
// 128-bit token; for multi-instance hosting, back this with a shared store.
const WINDOW_MS = 60_000;
const MAX_HITS = 20;
const hits = new Map<string, { count: number; resetAt: number }>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || now > entry.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_HITS;
}

export type PublicPayment =
  | { state: "rate_limited" }
  | { state: "not_found" }
  | { state: "confirmed"; referenceCode: string }
  | {
      state: "payable";
      payeeName: string;
      methodLabel: string;
      bankName: string | null;
      maskedAccount: string;
      fullAccountLabel: string;
      fullDetails: { label: string; value: string }[];
      amountCents: number;
      referenceCode: string;
    };

// Looks a payment request up by TOKEN only (username is cosmetic). Reads with the
// service role since the viewer is unauthenticated, rate-limits by IP, and logs
// the view. Full payout details are read here only, never embedded in the QR.
export async function loadPublicPayment(token: string, ip: string): Promise<PublicPayment> {
  if (rateLimited(ip)) return { state: "rate_limited" };
  if (!/^[a-f0-9]{16,64}$/.test(token)) return { state: "not_found" };

  const admin = createAdminClient();
  const { data: pr } = await admin
    .from("payment_requests")
    .select("id, application_id, amount_cents, reference_code, status, view_count")
    .eq("id", token)
    .maybeSingle();
  if (!pr) return { state: "not_found" };

  if (pr.status === "confirmed") return { state: "confirmed", referenceCode: pr.reference_code };

  // Log the view (first view sets viewed_at; pending -> viewed).
  await admin
    .from("payment_requests")
    .update({
      view_count: pr.view_count + 1,
      viewed_at: new Date().toISOString(),
      status: pr.status === "pending" ? "viewed" : pr.status,
    })
    .eq("id", pr.id);

  const { data: app } = await admin
    .from("applications")
    .select("user_id")
    .eq("id", pr.application_id)
    .maybeSingle();
  if (!app) return { state: "not_found" };

  const [{ data: profile }, { data: payout }] = await Promise.all([
    admin.from("profiles").select("full_name").eq("user_id", app.user_id).maybeSingle(),
    admin
      .from("payout_details")
      .select("method, details")
      .eq("user_id", app.user_id)
      .maybeSingle(),
  ]);

  const method = payout?.method ?? "";
  const details = (payout?.details as Record<string, string>) ?? {};
  const primaryKey = PRIMARY_FIELD[method] ?? "account_number";
  const primary = details[primaryKey] ?? "";
  const fullDetails = Object.entries(details)
    .filter(([, v]) => typeof v === "string" && v.length > 0)
    .map(([k, v]) => ({ label: k.replace(/_/g, " "), value: v }));

  return {
    state: "payable",
    payeeName: profile?.full_name ?? "the freelancer",
    methodLabel: methodLabel(method),
    bankName: details.bank_name ?? null,
    maskedAccount: primary ? maskTail(primary) : "—",
    fullAccountLabel: primaryKey.replace(/_/g, " "),
    fullDetails,
    amountCents: pr.amount_cents,
    referenceCode: pr.reference_code,
  };
}
