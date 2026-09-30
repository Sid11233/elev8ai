import "server-only";

import { createClient } from "@/lib/supabase/server";

export type FreelancerRating = { avg: number; count: number };

// Aggregate star ratings for a set of freelancers, via the security-definer
// function (companies can read the aggregate but not the raw comments).
export async function getFreelancerRatings(
  userIds: string[],
): Promise<Map<string, FreelancerRating>> {
  const ids = [...new Set(userIds)];
  const map = new Map<string, FreelancerRating>();
  if (!ids.length) return map;
  const supabase = await createClient();
  const { data } = await supabase.rpc("freelancer_ratings", { p_user_ids: ids });
  for (const r of data ?? []) {
    if (r.user_id) map.set(r.user_id, { avg: Number(r.avg_stars), count: Number(r.rating_count) });
  }
  return map;
}

// Application ids (from the given list) that have a paid payout — i.e. eligible
// for feedback. Uses the caller's RLS view of submissions/payouts.
export async function getPaidApplications(applicationIds: string[]): Promise<Set<string>> {
  const ids = [...new Set(applicationIds)];
  if (!ids.length) return new Set();
  const supabase = await createClient();
  const { data } = await supabase
    .from("submissions")
    .select("application_id, payout:payouts(status)")
    .in("application_id", ids);
  const paid = new Set<string>();
  for (const s of data ?? []) {
    if (s.payout?.status === "paid") paid.add(s.application_id);
  }
  return paid;
}

// Application ids (from the given list) the current user has already reviewed.
export async function getMyReviewedApplications(applicationIds: string[]): Promise<Set<string>> {
  const ids = [...new Set(applicationIds)];
  if (!ids.length) return new Set();
  const supabase = await createClient();
  // RLS returns only the caller's own reviews.
  const { data } = await supabase
    .from("job_reviews")
    .select("application_id")
    .in("application_id", ids);
  return new Set((data ?? []).map((r) => r.application_id));
}
