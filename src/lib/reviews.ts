import "server-only";

import { getPeople } from "@/lib/admin-people";
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

// Aggregate company ratings (freelancer -> company).
export async function getCompanyRatings(
  companyIds: string[],
): Promise<Map<string, FreelancerRating>> {
  const ids = [...new Set(companyIds)];
  const map = new Map<string, FreelancerRating>();
  if (!ids.length) return map;
  const supabase = await createClient();
  const { data } = await supabase.rpc("company_ratings", { p_company_ids: ids });
  for (const r of data ?? []) {
    if (r.company_id)
      map.set(r.company_id, { avg: Number(r.avg_stars), count: Number(r.rating_count) });
  }
  return map;
}

export type PublicReview = {
  id: string;
  stars: number;
  comment: string | null;
  created_at: string;
  authorName: string | null;
};

// Recent public reviews about a subject (a company or a talent user), newest
// first, with the reviewer's display name. job_reviews is readable by any
// signed-in user.
async function recentReviews(
  column: "subject_company_id" | "subject_user_id",
  id: string,
  limit = 20,
): Promise<PublicReview[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("job_reviews")
    .select("id, stars, comment, created_at, author_id")
    .eq(column, id)
    .not("stars", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  const rows = data ?? [];
  const people = await getPeople(rows.map((r) => r.author_id));
  return rows.map((r) => ({
    id: r.id,
    stars: r.stars as number,
    comment: r.comment,
    created_at: r.created_at,
    authorName: people.get(r.author_id)?.full_name ?? null,
  }));
}

export function getCompanyReviews(companyId: string) {
  return recentReviews("subject_company_id", companyId);
}
export function getUserReviews(userId: string) {
  return recentReviews("subject_user_id", userId);
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
