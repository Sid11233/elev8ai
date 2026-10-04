"use client";

import { useState, useTransition } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { resolvePayment } from "@/lib/payment-actions";

// One-click admin resolutions for a reported payment.
export function PaymentExceptionActions({
  requestId,
  talentId,
  companyOwnerId,
}: {
  requestId: string;
  talentId: string;
  companyOwnerId: string | null;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(
    action: "release" | "fail" | "request_statement",
    opts: { note?: string; strikeUserId?: string } = {},
  ) {
    start(async () => {
      setError(null);
      const res = await resolvePayment(requestId, action, opts);
      if (res && !res.ok) setError(res.message ?? "Couldn't apply. Try again.");
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={pending} onClick={() => run("release")}>
          Release file (paid)
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => run("release", { strikeUserId: talentId, note: "False non-receipt claim" })}
        >
          Release + strike talent
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() =>
            run("fail", {
              strikeUserId: companyOwnerId ?? undefined,
              note: "Unproven payment claim",
            })
          }
        >
          Uphold talent + strike company
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => run("request_statement")}
        >
          Request statement
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
