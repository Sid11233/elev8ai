"use client";

import { useActionState } from "react";

import { type CheckoutState, startCheckout } from "@/app/app/learn/[slug]/checkout-action";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { formatCents } from "@/lib/money";

export function BuyButton({ courseId, priceCents }: { courseId: string; priceCents: number }) {
  const [state, formAction, pending] = useActionState<CheckoutState, FormData>(
    () => startCheckout(courseId),
    {},
  );
  return (
    <form action={formAction} className="space-y-2">
      <Button type="submit" className="h-11 w-full sm:w-auto sm:px-8" disabled={pending}>
        {pending
          ? "Starting checkout…"
          : priceCents === 0
            ? "Get it free"
            : `Buy for ${formatCents(priceCents)}`}
      </Button>
      {state.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
    </form>
  );
}
