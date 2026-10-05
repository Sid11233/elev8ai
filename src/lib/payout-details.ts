import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type DecryptedPayoutDetails = { method: string; details: Record<string, unknown> } | null;

// payout_details.details is encrypted at rest (see migration
// 20261005100000_encrypt_sensitive_data.sql) — read it only through this RPC,
// never by selecting the column directly (it always reads back as `{}`).
// Pass an admin client for server-only contexts with no user session (e.g. the
// public payment page, which independently validates its own token first).
export async function getDecryptedPayoutDetails(
  userId: string,
  client?: ReturnType<typeof createAdminClient>,
): Promise<DecryptedPayoutDetails> {
  const supabase = client ?? (await createClient());
  const { data } = await supabase.rpc("get_payout_details", { p_user_id: userId });
  const row = data?.[0];
  if (!row) return null;
  return { method: row.method, details: (row.details as Record<string, unknown>) ?? {} };
}

export type DecryptedCompanyBankDetails = {
  beneficiary_name: string | null;
  bank_name: string | null;
  account_number: string | null;
} | null;

export async function getDecryptedCompanyBankDetails(
  companyId: string,
): Promise<DecryptedCompanyBankDetails> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_company_bank_details", { p_company_id: companyId });
  return data?.[0] ?? null;
}
