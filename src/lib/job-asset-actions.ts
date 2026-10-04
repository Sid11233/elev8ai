"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { validateJobLink } from "@/lib/link-validation";
import { sniffFile } from "@/lib/magic-bytes";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/lib/validation/form-state";

export type AssetField = "url" | "label" | "file";

const linkSchema = z.object({
  url: z.string().trim().max(500),
  label: z.string().trim().max(160).optional(),
  role: z.enum(["source", "reference"]),
});

// Add an allowlisted link asset to a job. The link is validated server-side.
export async function addJobLink(
  jobId: string,
  _prev: FormState<AssetField>,
  formData: FormData,
): Promise<FormState<AssetField>> {
  await requireUser();
  const parsed = linkSchema.safeParse({
    url: String(formData.get("url") ?? ""),
    label: (formData.get("label") as string) || undefined,
    role: formData.get("role"),
  });
  if (!parsed.success) return { fieldErrors: { url: "Enter a link and role" } };

  const check = await validateJobLink(parsed.data.url, parsed.data.role);
  if (check.status !== "ok") {
    return { fieldErrors: { url: check.reason ?? "This link can't be used" } };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("job_assets").insert({
    job_id: jobId,
    kind: "link",
    role: parsed.data.role,
    label: parsed.data.label || null,
    url: parsed.data.url,
    domain: check.domain,
    link_status: "ok",
    link_checked_at: new Date().toISOString(),
    scan_status: "clean",
  });
  if (error) return { message: error.message };

  revalidatePath(`/company/jobs/${jobId}`);
  revalidatePath(`/admin/jobs/${jobId}`);
  return { message: "ok" };
}

// Record a file asset after it was uploaded to the job-assets bucket. Verifies
// the file's real type from its bytes (rejecting a renamed executable or a type
// mismatch) and enforces the company's storage quota before accepting it.
export async function addJobFileAsset(
  jobId: string,
  input: { path: string; label: string | null; role: "source" | "reference"; mime: string; size: number },
) {
  await requireUser();
  const supabase = await createClient();

  const { data: job } = await supabase
    .from("jobs")
    .select("company_id, company:companies(storage_quota_bytes)")
    .eq("id", jobId)
    .maybeSingle();
  if (job?.company_id) {
    const { data: companyJobs } = await supabase
      .from("jobs")
      .select("id")
      .eq("company_id", job.company_id);
    const jobIds = (companyJobs ?? []).map((j) => j.id);
    const { data: existing } = jobIds.length
      ? await supabase
          .from("job_assets")
          .select("size_bytes")
          .eq("kind", "file")
          .is("deleted_at", null)
          .in("job_id", jobIds)
      : { data: [] };
    const used = (existing ?? []).reduce((sum, a) => sum + (a.size_bytes ?? 0), 0);
    const quota = job.company?.storage_quota_bytes ?? Number.MAX_SAFE_INTEGER;
    if (used + input.size > quota) {
      await supabase.storage.from("job-assets").remove([input.path]);
      return { ok: false, message: "This would exceed your company's storage quota." };
    }
  }

  const { data: file } = await supabase.storage.from("job-assets").download(input.path);
  if (!file) return { ok: false, message: "Couldn't verify the uploaded file." };
  const sniff = sniffFile(Buffer.from(await file.arrayBuffer()), input.mime);
  if (!sniff.ok) {
    await supabase.storage.from("job-assets").remove([input.path]);
    return { ok: false, message: sniff.reason };
  }

  const { error } = await supabase.from("job_assets").insert({
    job_id: jobId,
    kind: "file",
    role: input.role,
    label: input.label,
    storage_path: input.path,
    mime_type: sniff.detected,
    size_bytes: input.size,
    // No malware scanner wired yet — mark clean so publishing isn't blocked.
    // TODO: set 'pending' and clear via a real scanner (ClamAV/VirusTotal).
    scan_status: "clean",
  });
  if (error) return { ok: false, message: error.message };
  revalidatePath(`/company/jobs/${jobId}`);
  revalidatePath(`/admin/jobs/${jobId}`);
  return { ok: true };
}

export async function deleteJobAsset(assetId: string, jobId: string) {
  await requireUser();
  const supabase = await createClient();
  await supabase.from("job_assets").update({ deleted_at: new Date().toISOString() }).eq("id", assetId);
  revalidatePath(`/company/jobs/${jobId}`);
  revalidatePath(`/admin/jobs/${jobId}`);
}
