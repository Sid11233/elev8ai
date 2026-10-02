import { MessageSquareText } from "lucide-react";
import type { Metadata } from "next";

import { PersonLine } from "@/components/admin/person-line";
import { PageHeader } from "@/components/page-header";
import { StarRating } from "@/components/reviews/star-rating";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getPeople } from "@/lib/admin-people";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime } from "@/lib/datetime";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Feedback · Admin · lockedinnn" };

export default async function AdminFeedbackPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data: reviews } = await supabase
    .from("job_reviews")
    .select("*, job:jobs(title)")
    .order("created_at", { ascending: false })
    .limit(200);
  const list = reviews ?? [];
  const people = await getPeople(list.map((r) => r.author_id));

  return (
    <>
      <PageHeader
        title="Feedback"
        description="Private feedback and ratings left after paid jobs. Only you see this."
      />

      {list.length ? (
        <div className="space-y-3">
          {list.map((r) => (
            <Card key={r.id}>
              <CardContent className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <PersonLine person={people.get(r.author_id)} />
                  <Badge variant="secondary">
                    {r.author_role === "provider" ? "From provider" : "From freelancer"}
                  </Badge>
                </div>
                <p className="text-sm">
                  <span className="font-medium">{r.job?.title ?? "Job"}</span>
                  <span className="text-muted-foreground"> · {formatDateTime(r.created_at)}</span>
                </p>
                {r.stars != null && <StarRating avg={r.stars} count={1} />}
                {r.comment ? (
                  <p className="rounded-lg bg-secondary/50 p-3 text-sm whitespace-pre-line">
                    {r.comment}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No written feedback</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <MessageSquareText className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No feedback yet.</p>
          </CardContent>
        </Card>
      )}
    </>
  );
}
