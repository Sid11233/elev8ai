import "server-only";

import { createClient } from "@/lib/supabase/server";

// Checks that block publishing a job: any asset scan still pending/failed, or
// any Source link inaccessible/blocked. (proof_instructions + category are
// already enforced by jobSchema.) Only meaningful once a job exists, since
// assets are added after creation.
export async function checkPublishGate(jobId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data: assets } = await supabase
    .from("job_assets")
    .select("kind, role, label, url, link_status, scan_status")
    .eq("job_id", jobId)
    .is("deleted_at", null);

  for (const a of assets ?? []) {
    if (a.kind === "file" && a.scan_status !== "clean") {
      return `"${a.label ?? "A file"}" hasn't finished its safety scan yet.`;
    }
    if (a.kind === "link" && a.role === "source" && a.link_status !== "ok") {
      return `The source link "${a.label ?? a.url}" is ${a.link_status === "unchecked" ? "not checked yet" : a.link_status}. Fix or remove it before publishing.`;
    }
  }
  return null;
}
