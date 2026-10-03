"use client";

import { useState, useTransition } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

import { confirmPaymentReceived } from "../actions";

export function ConfirmPaymentButton({
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
        {pending ? "Confirming…" : "I received my payment"}
      </Button>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
