import { Star } from "lucide-react";

import { cn } from "@/lib/utils";

// Read-only average rating display.
export function StarRating({
  avg,
  count,
  className,
}: {
  avg: number;
  count: number;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1 text-sm", className)}>
      <span className="inline-flex" aria-hidden>
        {[1, 2, 3, 4, 5].map((n) => (
          <Star
            key={n}
            className={cn(
              "size-3.5",
              n <= Math.round(avg) ? "fill-warning text-warning" : "text-muted-foreground/40",
            )}
          />
        ))}
      </span>
      <span className="font-medium">{avg.toFixed(1)}</span>
      <span className="text-muted-foreground">
        ({count} {count === 1 ? "review" : "reviews"})
      </span>
    </span>
  );
}
