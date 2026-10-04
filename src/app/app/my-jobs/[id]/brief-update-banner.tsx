"use client";

import { useState, useTransition } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

import { acknowledgeBriefVersion } from "../actions";

// Shown when the job's description/assets changed after the talent was
// accepted. They must acknowledge the new brief.
export function BriefUpdateBanner({ applicationId }: { applicationId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <Alert className="border-warning/40 bg-warning/10">
      <AlertDescription className="space-y-2">
        <p>The company updated this job&apos;s brief since you were accepted. Review the details above, then acknowledge to continue.</p>
        <Button
          size="sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              const res = await acknowledgeBriefVersion(applicationId);
              if (res && !res.ok) setError(res.message ?? "Couldn't acknowledge. Try again.");
            })
          }
        >
          {pending ? "Saving…" : "Acknowledge the update"}
        </Button>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </AlertDescription>
    </Alert>
  );
}
