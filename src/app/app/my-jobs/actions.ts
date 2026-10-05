"use server";

import { revalidatePath } from "next/cache";

import { requireOnboardedProfile } from "@/lib/auth";
import { hasBlockedDeliveryLink } from "@/lib/delivery-guard";
import { notifyNewSubmission } from "@/lib/notify-events";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { sniffFile } from "@/lib/magic-bytes";
import { type FormState, fieldErrorsOf, textValues } from "@/lib/validation/form-state";
import { type SubmissionField, submissionSchema } from "@/lib/validation/submission";
import { isImage, isPdf, watermarkImage, watermarkPdf } from "@/lib/watermark";

// For file_watermarked jobs, make a watermarked, downscaled preview of each
// image so the company can review it before paying, without getting the clean
// file. Runs with the service role (private buckets). Best-effort: a failed
// preview just means that file stays withheld until payment.
async function buildPreviews(submissionId: string) {
  const admin = createAdminClient();
  const { data: sub } = await admin
    .from("submissions")
    .select("file_paths, application:applications(job:jobs(proof_type))")
    .eq("id", submissionId)
    .single();
  if (!sub || sub.application?.job?.proof_type !== "file_watermarked") return;

  const previews: string[] = [];
  for (const path of sub.file_paths) {
    const { data: file } = await admin.storage.from("submissions").download(path);
    if (!file) continue;
    const base = path.replace(/\.[^.]+$/, "");
    try {
      const input = Buffer.from(await file.arrayBuffer());
      let out: Buffer;
      let previewPath: string;
      let contentType: string;
      if (isImage(file.type)) {
        out = await watermarkImage(input);
        previewPath = `${base}.preview.png`;
        contentType = "image/png";
      } else if (isPdf(file.type)) {
        out = await watermarkPdf(input);
        previewPath = `${base}.preview.pdf`;
        contentType = "application/pdf";
      } else {
        continue; // other types stay withheld until payment
      }
      const up = await admin.storage
        .from("submission-previews")
        .upload(previewPath, out, { contentType, upsert: true });
      if (!up.error) previews.push(previewPath);
    } catch {
      // skip this file's preview
    }
  }
  if (previews.length) {
    await admin.from("submissions").update({ preview_paths: previews }).eq("id", submissionId);
  }
}

// Talent confirms they received the Juice payment: marks the payout paid and
// unlocks the clean files for the company.
export async function confirmPaymentReceived(submissionId: string, applicationId: string) {
  await requireOnboardedProfile();
  const supabase = await createClient();
  const { error } = await supabase.rpc("confirm_payment_received", {
    p_submission_id: submissionId,
  });
  if (error) return { ok: false, message: error.message };
  revalidatePath(`/app/my-jobs/${applicationId}`);
  revalidatePath("/app/earnings");
  return { ok: true };
}

// Talent disputes a reported payment (couldn't find the transaction). Sends it to
// admin review; the clean file stays locked.
export async function disputePayment(
  submissionId: string,
  applicationId: string,
  txnIdEntered?: string,
) {
  await requireOnboardedProfile();
  const supabase = await createClient();
  const { error } = await supabase.rpc("dispute_payment", {
    p_submission_id: submissionId,
    p_txn_id_entered: txnIdEntered || undefined,
  });
  if (error) return { ok: false, message: error.message };
  revalidatePath(`/app/my-jobs/${applicationId}`);
  return { ok: true };
}

// Talent reports a job asset link that won't open. Notifies the company and
// gives it 24 hours to fix while pausing the deadline (kept as dispute evidence).
export async function reportBrokenLink(assetId: string, jobId: string) {
  const profile = await requireOnboardedProfile();
  const supabase = await createClient();
  const { error } = await supabase
    .from("link_reports")
    .insert({ job_asset_id: assetId, reported_by: profile.user_id });
  if (error) return { ok: false, message: error.message };
  revalidatePath(`/app/jobs/${jobId}`);
  return { ok: true };
}

// Talent acknowledges a new brief version (the job's description/assets changed
// after they were accepted).
export async function acknowledgeBriefVersion(applicationId: string) {
  await requireOnboardedProfile();
  const supabase = await createClient();
  const { error } = await supabase.rpc("acknowledge_brief_version", {
    p_application_id: applicationId,
  });
  if (error) return { ok: false, message: error.message };
  revalidatePath(`/app/my-jobs/${applicationId}`);
  return { ok: true };
}

// Talent reports that a company asked them to deliver outside the platform.
// Logs an event and alerts admins to open a strike review.
export async function reportOffPlatform(applicationId: string) {
  const profile = await requireOnboardedProfile();
  const admin = createAdminClient();
  const { data: pr } = await admin
    .from("payment_requests")
    .select("id")
    .eq("application_id", applicationId)
    .maybeSingle();
  await admin.from("payment_events").insert({
    payment_request_id: pr?.id ?? null,
    actor_id: profile.user_id,
    event_type: "off_platform_report",
    payload: { application_id: applicationId },
  });
  const { getAdminUserIds, notifyMany } = await import("@/lib/notify");
  const admins = await getAdminUserIds();
  await notifyMany(admins, {
    type: "off_platform_report",
    title: "Off-platform delivery reported",
    body: "A freelancer reported being asked to deliver off-platform. Review it.",
    link: "/admin/payments",
  });
  revalidatePath(`/app/my-jobs/${applicationId}`);
  return { ok: true };
}

export async function submitWork(
  applicationId: string,
  pay: { perUnit: boolean },
  _prev: FormState<SubmissionField>,
  formData: FormData,
): Promise<FormState<SubmissionField>> {
  await requireOnboardedProfile();
  const values = textValues(formData, ["links", "file_paths", "notes", "units"] as const);
  const parsed = submissionSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), values };

  let units: number | null = null;
  if (pay.perUnit) {
    if (!/^\d+$/.test(parsed.data.units) || Number(parsed.data.units) < 1) {
      return { fieldErrors: { units: "Enter how many you completed (a whole number)" }, values };
    }
    units = Number(parsed.data.units);
  }

  const supabase = await createClient();

  // Delivery-leak rules for file_watermarked jobs: the deliverable must be an
  // uploaded file (no links), and storage/transfer links can't hide in the notes.
  const { data: appJob } = await supabase
    .from("applications")
    .select("job:jobs(proof_type)")
    .eq("id", applicationId)
    .maybeSingle();
  if (appJob?.job?.proof_type === "file_watermarked") {
    if (parsed.data.links.length > 0) {
      return {
        fieldErrors: { links: "For this job, upload the file. Links aren't accepted as the deliverable." },
        values,
      };
    }
    if (hasBlockedDeliveryLink(parsed.data.notes)) {
      return {
        fieldErrors: { notes: "Storage or transfer links aren't allowed here. Upload the file instead." },
        values,
      };
    }
  }

  // Verify each uploaded file's real type from its bytes — the storage bucket
  // only checks the client-declared Content-Type, which an attacker controls.
  // This is proof of work a company will open, so a renamed executable here is
  // a real risk to the person downloading it.
  for (const path of parsed.data.file_paths) {
    const { data: file } = await supabase.storage.from("submissions").download(path);
    if (!file) continue;
    const sniff = sniffFile(Buffer.from(await file.arrayBuffer()), file.type);
    if (!sniff.ok) {
      await supabase.storage.from("submissions").remove([path]);
      return { fieldErrors: { files: sniff.reason }, values };
    }
  }

  // submit_work checks ownership, acceptance, file paths and duplicates.
  const { data: submissionId, error } = await supabase.rpc("submit_work", {
    p_application_id: applicationId,
    p_notes: parsed.data.notes,
    p_links: parsed.data.links,
    p_file_paths: parsed.data.file_paths,
    p_units_claimed: units ?? undefined,
  });
  if (error) return { message: error.message, values };

  if (submissionId) await buildPreviews(submissionId);
  await notifyNewSubmission(applicationId);

  revalidatePath(`/app/my-jobs/${applicationId}`);
  revalidatePath("/app/my-jobs");
  return {};
}
