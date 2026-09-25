"use client";

import { useActionState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { FormState } from "@/lib/validation/form-state";

import { decideApplication } from "./actions";

export function DecisionForm({ applicationId }: { applicationId: string }) {
  const [state, formAction, pending] = useActionState<FormState<"note">, FormData>(
    decideApplication.bind(null, applicationId),
    {},
  );

  return (
    <form action={formAction} className="space-y-2">
      <Textarea
        name="note"
        rows={2}
        maxLength={1000}
        placeholder="Optional note to the applicant"
        aria-label="Note to the applicant"
      />
      {state.message && (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}
      <div className="flex gap-2">
        <Button type="submit" name="decision" value="accept" size="sm" disabled={pending}>
          Accept
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
