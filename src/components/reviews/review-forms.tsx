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

function Thanks() {
  return (
    <Alert>
      <AlertDescription>Thanks for your feedback!</AlertDescription>
    </Alert>
  );
}

// Provider (company/admin) rates the freelancer and can add private feedback.
export function ProviderReviewForm({
  applicationId,
  revalidate,
}: {
  applicationId: string;
  revalidate: string;
}) {
  const [state, formAction, pending] = useActionState<FormState<ReviewField>, FormData>(
    submitJobReview.bind(null, applicationId, revalidate),
    {},
  );
  const [stars, setStars] = useState(0);
  const [hover, setHover] = useState(0);
  if (state.message === "ok") return <Thanks />;

  return (
    <form action={formAction} className="space-y-3 rounded-xl border bg-secondary/30 p-3">
      <p className="text-sm font-medium">Rate this freelancer</p>
      <input type="hidden" name="stars" value={stars || ""} />
      <div className="flex items-center gap-1" role="radiogroup" aria-label="Star rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`${n} ${n === 1 ? "star" : "stars"}`}
            aria-checked={stars === n}
            role="radio"
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onClick={() => setStars(n)}
            className="p-0.5"
          >
            <Star
              className={cn(
                "size-6",
                n <= (hover || stars)
                  ? "fill-warning text-warning"
                  : "text-muted-foreground/40",
              )}
            />
          </button>
        ))}
      </div>
      {state.fieldErrors?.stars && (
        <p className="text-sm text-destructive">{state.fieldErrors.stars}</p>
      )}
      <FormField
        id={`rc-${applicationId}`}
        label="Private note to admin (optional)"
        error={state.fieldErrors?.comment}
      >
        <Textarea id={`rc-${applicationId}`} name="comment" rows={2} maxLength={2000} />
      </FormField>
      {state.message && state.message !== "ok" && (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Submitting…" : "Submit rating"}
      </Button>
    </form>
  );
}

// Freelancer leaves private feedback to the admin about the job.
export function FreelancerFeedbackForm({
  applicationId,
  revalidate,
}: {
  applicationId: string;
  revalidate: string;
}) {
  const [state, formAction, pending] = useActionState<FormState<ReviewField>, FormData>(
    submitJobReview.bind(null, applicationId, revalidate),
    {},
  );
  if (state.message === "ok") return <Thanks />;

  return (
    <form action={formAction} className="space-y-3">
      <FormField
        id={`ff-${applicationId}`}
        label="How was this job?"
        hint="Only the lockedinnn admin sees this — tell us about your experience."
        error={state.fieldErrors?.comment}
      >
        <Textarea
          id={`ff-${applicationId}`}
          name="comment"
          rows={3}
          maxLength={2000}
          placeholder="What went well? Anything we should know?"
        />
      </FormField>
      {state.message && state.message !== "ok" && (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Sending…" : "Send feedback"}
      </Button>
    </form>
  );
}
