import { Star } from "lucide-react";

import { formatDate } from "@/lib/datetime";
import type { PublicReview } from "@/lib/reviews";
import { cn } from "@/lib/utils";

function Stars({ n }: { n: number }) {
  return (
    <span className="inline-flex" aria-label={`${n} of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={cn("size-3.5", i <= n ? "fill-warning text-warning" : "text-muted-foreground/40")}
        />
      ))}
    </span>
  );
}

// Public list of reviews about a company or a talent.
export function ReviewList({ reviews }: { reviews: PublicReview[] }) {
  if (!reviews.length) {
    return <p className="text-sm text-muted-foreground">No reviews yet.</p>;
  }
  return (
    <ul className="space-y-3">
      {reviews.map((r) => (
        <li key={r.id} className="rounded-lg border bg-secondary/30 p-3">
          <div className="flex items-center justify-between gap-2">
            <Stars n={r.stars} />
            <span className="text-xs text-muted-foreground">{formatDate(r.created_at)}</span>
          </div>
          {r.comment && <p className="mt-1.5 text-sm whitespace-pre-line">{r.comment}</p>}
          <p className="mt-1 text-xs text-muted-foreground">— {r.authorName ?? "A client"}</p>
        </li>
      ))}
    </ul>
  );
}
