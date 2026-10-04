"use client";

import { useState, useTransition } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

import { confirmPaymentReceived, disputePayment } from "../actions";

// Shown once the company has reported paying. The talent confirms (unlocks the
// file, settles) or disputes (sends it to admin; file stays locked).
export function ConfirmOrDispute({
  submissionId,
  applicationId,
}: {
  submissionId: string;
  applicationId: string;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              const res = await confirmPaymentReceived(submissionId, applicationId);
              if (res && !res.ok) setError(res.message ?? "Couldn't confirm. Try again.");
            })
          }
        >
          {pending ? "Working…" : "Yes, I received it"}
        </Button>
        <Button
          variant="outline"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              const res = await disputePayment(submissionId, applicationId);
              if (res && !res.ok) setError(res.message ?? "Couldn't submit. Try again.");
            })
          }
        >
          I didn&apos;t get it
        </Button>
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
