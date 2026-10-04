"use server";

import { createHash } from "node:crypto";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin, requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { parseMoneyToCents } from "@/lib/money";
import type { FormState } from "@/lib/validation/form-state";

export type ReportField = "txn_id" | "amount" | "proof";

const reportSchema = z.object({
  txn_id: z.string().trim().min(3, "Enter the Juice transaction id").max(100),
  amount: z.string().trim(),
  proof_path: z.string().trim().max(500).optional(),
});

// Company/admin reports the Juice transfer: transaction id, amount paid, and a
// proof image. The proof is hashed server-side (duplicate images are rejected by
// the DB), and report_payment enforces txn-id uniqueness + records the event.
export async function reportPayment(
  submissionId: string,
  _prev: FormState<ReportField>,
  formData: FormData,
): Promise<FormState<ReportField>> {
  await requireUser();
  const parsed = reportSchema.safeParse({
    txn_id: String(formData.get("txn_id") ?? ""),
    amount: String(formData.get("amount") ?? ""),
    proof_path: (formData.get("proof_path") as string) || undefined,
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { fieldErrors: { [issue.path[0] as ReportField]: issue.message } };
  }
  const amountCents = parseMoneyToCents(parsed.data.amount);

  // Hash the proof image server-side (if provided) so duplicates can be rejected.
  let proofHash: string | undefined;
  if (parsed.data.proof_path) {
    const admin = createAdminClient();
    const { data: file } = await admin.storage.from("payment-proofs").download(parsed.data.proof_path);
    if (file) {
      proofHash = createHash("sha256").update(Buffer.from(await file.arrayBuffer())).digest("hex");
    }
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("report_payment", {
    p_submission_id: submissionId,
    p_txn_id: parsed.data.txn_id,
    p_proof_path: parsed.data.proof_path ?? undefined,
    p_proof_hash: proofHash,
    p_amount_cents: amountCents ?? undefined,
  });
  if (error) return { message: error.message };

  revalidatePath("/company/submissions");
  revalidatePath("/admin/submissions");
  return { message: "ok" };
}

// Admin exceptions-queue actions: release the file, fail the claim, or ask for a
// bank statement — optionally issuing a strike.
export async function resolvePayment(
  requestId: string,
  action: "release" | "fail" | "request_statement",
  opts: { note?: string; strikeUserId?: string } = {},
) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_resolve_payment", {
    p_request_id: requestId,
    p_action: action,
    p_note: opts.note ?? undefined,
    p_strike_user_id: opts.strikeUserId ?? undefined,
  });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/admin/payments");
  return { ok: true };
}
