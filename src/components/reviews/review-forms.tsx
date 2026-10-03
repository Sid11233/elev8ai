"use client";

import { Star } from "lucide-react";
import { useActionState, useState } from "react";

import { FormField } from "@/components/form-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { type ReviewField, submitJobReview } from "@/lib/review-actions";
import { cn } from "@/lib/utils";
import type { FormState } from "@/lib/validation/form-state";

// Two-way public review: a 1-5 rating plus an optional comment. Used by both the
// provider (rating the freelancer) and the freelancer (rating the company).
function JobReviewForm({
  applicationId,
  revalidate,
  title,
  commentLabel,
}: {
  applicationId: string;
  revalidate: string;
  title: string;
  commentLabel: string;
}) {
  const [state, formAction, pending] = useActionState<FormState<ReviewField>, FormData>(
    submitJobReview.bind(null, applicationId, revalidate),
    {},
  );
  const [stars, setStars] = useState(0);
  const [hover, setHover] = useState(0);

  if (state.message === "ok") {
    return (
      <Alert>
        <AlertDescription>Thanks for your review.</AlertDescription>
      </Alert>
    );
  }

  return (
    <form action={formAction} className="space-y-3 rounded-xl border bg-secondary/30 p-3">
      <p className="text-sm font-medium">{title}</p>
      <input type="hidden" name="stars" value={stars || ""} />
      <div className="flex items-center gap-1" role="radiogroup" aria-label="Star rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={stars === n}
            aria-label={`${n} ${n === 1 ? "star" : "stars"}`}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onClick={() => setStars(n)}
            className="p-0.5"
          >
            <Star
              className={cn(
                "size-6",
                n <= (hover || stars) ? "fill-warning text-warning" : "text-muted-foreground/40",
              )}
            />
          </button>
        ))}
      </div>
      {state.fieldErrors?.stars && (
        <p className="text-sm text-destructive">{state.fieldErrors.stars}</p>
      )}
      <FormField id={`rc-${applicationId}`} label={commentLabel} error={state.fieldErrors?.comment}>
        <Textarea id={`rc-${applicationId}`} name="comment" rows={2} maxLength={2000} />
      </FormField>
      {state.message && state.message !== "ok" && (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Submitting…" : "Submit review"}
      </Button>
    </form>
  );
}

// Provider rates the freelancer.
export function ProviderReviewForm({
  applicationId,
  revalidate,
}: {
  applicationId: string;
  revalidate: string;
}) {
  return (
    <JobReviewForm
      applicationId={applicationId}
      revalidate={revalidate}
      title="Rate this freelancer"
      commentLabel="Comment (optional, public)"
    />
  );
}

// Freelancer rates the company.
export function FreelancerReviewForm({
  applicationId,
  revalidate,
}: {
  applicationId: string;
  revalidate: string;
}) {
  return (
    <JobReviewForm
      applicationId={applicationId}
      revalidate={revalidate}
      title="Rate this company"
      commentLabel="Comment (optional, public)"
    />
  );
}
