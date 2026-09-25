"use client";

import { useActionState, useState } from "react";

import { FormField } from "@/components/form-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { submitWithoutReset } from "@/lib/forms";
import { PAYOUT_METHODS } from "@/lib/payout-methods";

import { type PayoutFormState, savePayoutDetails } from "./actions";

export function PayoutForm({
  initialMethod,
  initialDetails,
}: {
  initialMethod: string | null;
  initialDetails: Record<string, unknown>;
}) {
  const [state, formAction, pending] = useActionState<PayoutFormState, FormData>(
    savePayoutDetails,
    {},
  );
  const [method, setMethod] = useState(initialMethod ?? PAYOUT_METHODS[0].value);
  const config = PAYOUT_METHODS.find((m) => m.value === method) ?? PAYOUT_METHODS[0];
  const errors = state.fieldErrors ?? {};
  const saved = state.message === "ok";

  const value = (key: string) =>
    state.values?.[key] ??
    (method === initialMethod ? ((initialDetails[key] as string) ?? "") : "");

  return (
    <form onSubmit={submitWithoutReset(formAction)} className="max-w-md space-y-4" noValidate>
      <FormField id="method" label="Payout method" error={errors.method}>
        <NativeSelect
          id="method"
          name="method"
          value={method}
          onChange={(e) => setMethod(e.target.value)}
        >
          {PAYOUT_METHODS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </NativeSelect>
      </FormField>

      {config.fields.map((field) => (
        <FormField key={field.key} id={field.key} label={field.label} error={errors[field.key]}>
          <Input
            id={field.key}
            name={field.key}
            defaultValue={value(field.key)}
            placeholder={"placeholder" in field ? field.placeholder : undefined}
            className="h-11"
          />
        </FormField>
      ))}

      {saved && (
        <Alert>
          <AlertDescription className="text-primary">Payout details saved.</AlertDescription>
        </Alert>
      )}
      {state.message && !saved && (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}

      <Button type="submit" className="h-11 px-6" disabled={pending}>
        {pending ? "Saving…" : "Save payout details"}
      </Button>
    </form>
  );
}
