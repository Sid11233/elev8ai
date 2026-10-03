"use server";

import { revalidatePath } from "next/cache";

import { requireOnboardedProfile } from "@/lib/auth";
import { notifyNewSubmission } from "@/lib/notify-events";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
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
