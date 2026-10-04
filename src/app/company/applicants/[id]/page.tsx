import { ArrowLeft, BadgeCheck, ExternalLink, FileText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ReviewList } from "@/components/reviews/review-list";
import { StarRating } from "@/components/reviews/star-rating";
import { UserAvatar } from "@/components/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireCompany } from "@/lib/auth";
import { getFreelancerRatings, getUserReviews } from "@/lib/reviews";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Applicant · lockedinnn" };

export default async function ApplicantProfilePage({
  params,
}: PageProps<"/company/applicants/[id]">) {
  const { profile: me } = await requireCompany();
  const { id } = await params;
  const supabase = await createClient();

  // Safe fields only — contact and payout details are never selected. RLS also
  // restricts this to a talent with a live application on one of our jobs.
  const { data: talent } = await supabase
    .from("profiles")
    .select("user_id, full_name, username, avatar_url, country, headline, about")
    .eq("user_id", id)
    .maybeSingle();
  if (!talent) notFound();

  const [{ data: badges }, { data: certs }, { data: items }, ratings, reviews] = await Promise.all([
    supabase.from("user_skills").select("skill:skills(name)").eq("user_id", id),
    supabase
      .from("certificates")
      .select("id, title, kind, status, verify_token, issued_at")
      .eq("user_id", id),
    supabase
      .from("portfolio_items")
      .select("id, title, kind, url, preview_path, visibility")
      .eq("user_id", id)
      .eq("visibility", "companies"),
    getFreelancerRatings([id]),
    getUserReviews(id),
  ]);

  const previewPaths = (items ?? [])
    .map((i) => i.preview_path)
    .filter((p): p is string => !!p);
  const previewUrls = new Map<string, string>();
  if (previewPaths.length) {
    const { data } = await supabase.storage
      .from("portfolio-previews")
      .createSignedUrls(previewPaths, 3600);
    for (const it of data ?? []) if (it.path && it.signedUrl) previewUrls.set(it.path, it.signedUrl);
  }

  // Log the view (service role; profile_views is not writable by companies).
  void createAdminClient()
    .from("profile_views")
    .insert({ viewer_id: me.user_id, talent_id: id })
    .then(() => {});

  const rating = ratings.get(id);
  const badgeNames = (badges ?? []).map((b) => b.skill?.name).filter((n): n is string => !!n);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link
        href="/company/applications"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Applications
      </Link>

      <Card>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-4">
            <UserAvatar name={talent.full_name} src={talent.avatar_url} className="size-16 text-lg" />
            <div className="min-w-0">
              <p className="text-lg font-semibold">{talent.full_name}</p>
              {talent.headline && <p className="text-sm text-primary">{talent.headline}</p>}
              <p className="text-xs text-muted-foreground">{talent.country}</p>
            </div>
          </div>
          {rating && <StarRating avg={rating.avg} count={rating.count} />}
          {talent.about && (
            <p className="text-sm whitespace-pre-line text-muted-foreground">{talent.about}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Badges & certificates</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {badgeNames.length ? (
              badgeNames.map((n) => (
                <Badge key={n} className="border-0 bg-primary/15 text-primary">
                  {n}
                </Badge>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No badges yet.</p>
            )}
          </div>
          {(certs ?? []).map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="inline-flex items-center gap-1.5">
                {(c.kind === "platform" || c.status === "valid") && (
                  <BadgeCheck className="size-4 text-success" />
                )}
                {c.title}
                {c.kind === "external" && c.status !== "valid" && (
                  <Badge variant="secondary">Unverified</Badge>
                )}
              </span>
              {c.verify_token && (
                <a
                  href={`/verify/${c.verify_token}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary"
                >
                  Verify <ExternalLink className="size-3" />
                </a>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Portfolio</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(items ?? []).length ? (
            (items ?? []).map((it) => (
              <div key={it.id} className="rounded-lg border p-3">
                <p className="text-sm font-medium">{it.title || it.kind}</p>
                {it.kind === "link" && it.url ? (
                  <a
                    href={it.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-primary"
                  >
                    {it.url} <ExternalLink className="size-3" />
                  </a>
                ) : it.preview_path && previewUrls.get(it.preview_path) ? (
                  <a
                    href={previewUrls.get(it.preview_path)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-primary"
                  >
                    <FileText className="size-3.5" /> View watermarked preview
                  </a>
                ) : (
                  <p className="text-xs text-muted-foreground">Preview unavailable</p>
                )}
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No portfolio items shared.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reviews</CardTitle>
        </CardHeader>
        <CardContent>
          <ReviewList reviews={reviews} />
        </CardContent>
      </Card>
    </div>
  );
}
