"use client";

import { useActionState, useState } from "react";

import { FormField } from "@/components/form-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { submitWithoutReset } from "@/lib/forms";
import { formatCents } from "@/lib/money";
import type { FormState } from "@/lib/validation/form-state";

import { reviewSubmission } from "./actions";

type Props = {
  submissionId: string;
  payCents: number;
  unitLabel: string | null; // per-unit jobs only
  maxUnits: number | null;
  unitsClaimed: number | null;
};

export function ReviewForm({ submissionId, payCents, unitLabel, maxUnits, unitsClaimed }: Props) {
  const [state, formAction, pending] = useActionState<FormState<"note" | "units">, FormData>(
    reviewSubmission.bind(null, submissionId),
    {},
  );
  const [units, setUnits] = useState(state.values?.units ?? String(unitsClaimed ?? ""));
  const errors = state.fieldErrors ?? {};

  // Live payout preview, capped at max units like the database does.
  const approvedUnits = /^\d+$/.test(units) ? Math.min(Number(units), maxUnits ?? Infinity) : 0;
  const payout = unitLabel ? payCents * approvedUnits : payCents;

  return (
    <form onSubmit={submitWithoutReset(formAction)} className="space-y-3" noValidate>
      {unitLabel && (
        <FormField
          id={`units-${submissionId}`}
          label={`${unitLabel[0].toUpperCase()}${unitLabel.slice(1)}s approved`}
          hint={maxUnits ? `Claimed ${unitsClaimed ?? 0} · paid up to ${maxUnits}` : undefined}
          error={errors.units}
        >
          <Input
            id={`units-${submissionId}`}
            name="units"
            inputMode="numeric"
            value={units}
            onChange={(e) => setUnits(e.target.value)}
            className="h-10 max-w-32"
          />
        </FormField>
      )}
      <p className="text-sm">
        Payout if approved:{" "}
        <span className="font-semibold text-primary">{formatCents(payout)}</span>
      </p>
      <FormField id={`note-${submissionId}`} label="Note to talent" error={errors.note}>
        <Textarea
          id={`note-${submissionId}`}
          name="note"
          rows={2}
          maxLength={2000}
          placeholder="Required when requesting changes or rejecting"
          defaultValue={state.values?.note ?? ""}
        />
      </FormField>
      {state.message && (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" name="decision" value="approved" size="sm" disabled={pending}>
          Approve
        </Button>
        <Button
          type="submit"
          name="decision"
          value="changes_requested"
          size="sm"
          variant="outline"
          disabled={pending}
        >
          Request changes
        </Button>
        <Button
          type="submit"
          name="decision"
          value="rejected"
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
