"use client";

import { useActionState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { submitWithoutReset } from "@/lib/forms";
import type { FormState } from "@/lib/validation/form-state";

import { reviewCoursePurchase } from "./actions";

export function ReviewForm({ purchaseId }: { purchaseId: string }) {
  const [state, formAction, pending] = useActionState<FormState<"note">, FormData>(
    reviewCoursePurchase.bind(null, purchaseId),
    {},
  );

  return (
    <form onSubmit={submitWithoutReset(formAction)} className="space-y-2">
      <Textarea
        name="note"
        rows={2}
        maxLength={1000}
        placeholder="Note (required to reject)"
        aria-label="Note"
      />
      {(state.fieldErrors?.note || state.message) && (
        <Alert variant="destructive">
          <AlertDescription>{state.fieldErrors?.note ?? state.message}</AlertDescription>
        </Alert>
      )}
      <div className="flex gap-2">
        <Button type="submit" name="decision" value="approve" size="sm" disabled={pending}>
          Approve &amp; unlock
        </Button>
        <Button
          type="submit"
          name="decision"
          value="reject"
          size="sm"
          variant="outline"
          disabled={pending}
        >
          Reject
        </Button>
      </div>
    </form>
  );
}
