"use client";

import { useActionState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { submitWithoutReset } from "@/lib/forms";
import type { FormState } from "@/lib/validation/form-state";

import { gradeAssignment } from "./actions";

export function GradeForm({ assignmentId, userId }: { assignmentId: string; userId: string }) {
  const [state, formAction, pending] = useActionState<FormState<"feedback">, FormData>(
    gradeAssignment.bind(null, assignmentId, userId),
    {},
  );

  return (
    <form onSubmit={submitWithoutReset(formAction)} className="space-y-2">
      <Textarea
        name="feedback"
        rows={2}
        maxLength={2000}
        placeholder="Feedback (required to fail; shown to talent)"
        aria-label="Feedback"
      />
      {(state.fieldErrors?.feedback || state.message) && (
        <Alert variant="destructive">
          <AlertDescription>{state.fieldErrors?.feedback ?? state.message}</AlertDescription>
        </Alert>
      )}
      <div className="flex gap-2">
        <Button type="submit" name="decision" value="pass" size="sm" disabled={pending}>
          Pass &amp; award badge
        </Button>
        <Button
          type="submit"
          name="decision"
          value="fail"
          size="sm"
          variant="outline"
          disabled={pending}
        >
          Fail
        </Button>
      </div>
    </form>
  );
}
