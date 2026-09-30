import "server-only";

import { createClient } from "@/lib/supabase/server";

export type ApplicantCompany = {
  id: string;
  owner_id: string;
  name: string;
  logo_url: string | null;
  type: string | null;
  description: string | null;
  website: string | null;
  services: string[];
};

// Companies owned by any of the given users, keyed by owner user id. Used to
// show an applying company's profile in the review queues (companies are
// readable by any signed-in user).
export async function getApplicantCompanies(
  userIds: string[],
): Promise<Map<string, ApplicantCompany>> {
  const ids = [...new Set(userIds)];
  if (!ids.length) return new Map();
  const supabase = await createClient();
  const { data } = await supabase
    .from("companies")
    .select("id, owner_id, name, logo_url, type, description, website, services")
    .in("owner_id", ids);

  const map = new Map<string, ApplicantCompany>();
  for (const c of data ?? []) if (c.owner_id) map.set(c.owner_id, { ...c, owner_id: c.owner_id });
  return map;
}
