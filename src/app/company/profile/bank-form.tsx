"use client";

import { useActionState } from "react";

import { FormField } from "@/components/form-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { FormState } from "@/lib/validation/form-state";

import { type BankField, saveCompanyBankDetails } from "./actions";

type Defaults = { beneficiary_name: string; bank_name: string; account_number: string };

export function CompanyBankForm({ defaults }: { defaults: Defaults }) {
  const [state, formAction, pending] = useActionState<FormState<BankField>, FormData>(
    saveCompanyBankDetails,
    {},
  );
  const errors = state.fieldErrors ?? {};
  const saved = state.message === "ok";
  const v = (k: BankField) => state.values?.[k] ?? defaults[k] ?? "";

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <p className="text-sm text-muted-foreground">
        Used only to refund you if a dispute is resolved in your favour — never for routine
        payments.
      </p>
      <FormField id="beneficiary_name" label="Beneficiary name" error={errors.beneficiary_name}>
        <Input id="beneficiary_name" name="beneficiary_name" defaultValue={v("beneficiary_name")} className="h-11" />
      </FormField>
      <FormField id="bank_name" label="Bank name" error={errors.bank_name}>
        <Input id="bank_name" name="bank_name" defaultValue={v("bank_name")} className="h-11" />
      </FormField>
      <FormField id="account_number" label="Account number" error={errors.account_number}>
        <Input id="account_number" name="account_number" defaultValue={v("account_number")} className="h-11" />
      </FormField>

      {state.message && !saved && (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}
      {saved && (
        <Alert>
          <AlertDescription>Saved.</AlertDescription>
        </Alert>
      )}

      <Button type="submit" className="h-11 px-6" disabled={pending}>
        {pending ? "Saving…" : "Save bank details"}
      </Button>
    </form>
  );
}
