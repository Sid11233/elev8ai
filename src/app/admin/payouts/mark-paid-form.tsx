"use client";

import { useActionState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { formatDate } from "@/lib/datetime";
import { formatCents } from "@/lib/money";
import type { FormState } from "@/lib/validation/form-state";

import { markPayoutsPaid } from "./actions";

const METHOD_LABELS: Record<string, string> = {
  bank: "Bank transfer",
  juice: "MCB Juice",
  wise: "Wise",
  paypal: "PayPal",
  other: "Other",
};

type OwedPayout = { id: string; amount_cents: number; created_at: string; jobTitle: string };

// One person's owed payouts: tick which ones you sent, then record how.
export function MarkPaidForm({ payouts }: { payouts: OwedPayout[] }) {
  const [state, formAction, pending] = useActionState<FormState<"method">, FormData>(
    markPayoutsPaid,
    {},
  );

  return (
    <form action={formAction} className="space-y-3">
      <ul className="divide-y rounded-lg border">
        {payouts.map((p) => (
          <li key={p.id}>
            <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm">
              <input
                type="checkbox"
                name="payout_ids"
                value={p.id}
                defaultChecked
                className="size-4 accent-primary"
              />
              <span className="min-w-0 flex-1 truncate">{p.jobTitle}</span>
              <span className="text-xs text-muted-foreground">{formatDate(p.created_at)}</span>
              <span className="font-medium tabular-nums">{formatCents(p.amount_cents)}</span>
            </label>
          </li>
        ))}
      </ul>
      <div className="grid gap-2 sm:grid-cols-[12rem_1fr_auto]">
        <NativeSelect name="method" defaultValue="" aria-label="Payment method" className="h-10">
          <option value="" disabled>
            Sent via…
          </option>
          {Object.entries(METHOD_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </NativeSelect>
        <Input
          name="reference"
          placeholder="Reference (optional)"
          aria-label="Payment reference"
          className="h-10"
        />
        <Button type="submit" className="h-10" disabled={pending}>
          {pending ? "Saving…" : "Mark paid"}
        </Button>
      </div>
      {state.message && (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}
    </form>
  );
}
