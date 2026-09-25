"use client";

import { useActionState } from "react";

import { FormField } from "@/components/form-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { FormState } from "@/lib/validation/form-state";

import { applyToJob } from "../actions";

export function ApplyForm({ jobId }: { jobId: string }) {
  const [state, formAction, pending] = useActionState<FormState<"pitch">, FormData>(
    applyToJob.bind(null, jobId),
    {},
  );

  return (
    <form action={formAction} className="space-y-3">
      <FormField
        id="pitch"
        label="Why you? (optional)"
        hint="A line or two about relevant experience helps you get picked."
        error={state.fieldErrors?.pitch}
      >
        <Textarea
          id="pitch"
          name="pitch"
          rows={3}
          maxLength={1000}
          defaultValue={state.values?.pitch ?? ""}
        />
      </FormField>
      {state.message && (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" className="h-11 w-full sm:w-auto sm:px-8" disabled={pending}>
        {pending ? "Applying…" : "Apply"}
      </Button>
    </form>
  );
}
