"use client";

import { useActionState } from "react";

import { FormField } from "@/components/form-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { CATEGORY_LABELS, JOB_CATEGORIES } from "@/lib/jobs";
import type { FormState } from "@/lib/validation/form-state";

import { type CompanyOnboardingField, completeCompanyOnboarding } from "./company-actions";

const TYPES = ["Agency", "Studio", "Brand", "Freelance team", "Other"];

export function CompanyOnboardingForm() {
  const [state, formAction, pending] = useActionState<FormState<CompanyOnboardingField>, FormData>(
    completeCompanyOnboarding,
    {},
  );
  const errors = state.fieldErrors ?? {};
  const v = (k: CompanyOnboardingField) => state.values?.[k] ?? "";

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <FormField id="name" label="Company name" error={errors.name}>
        <Input id="name" name="name" required defaultValue={v("name")} className="h-11" />
      </FormField>

      <FormField id="type" label="Type of company" error={errors.type}>
        <NativeSelect id="type" name="type" defaultValue={v("type") || "Agency"}>
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </NativeSelect>
      </FormField>

      <FormField id="phone" label="Phone" error={errors.phone}>
        <Input
          id="phone"
          name="phone"
          type="tel"
          placeholder="+230 5xxx xxxx"
          defaultValue={v("phone")}
          className="h-11"
        />
      </FormField>

      <FormField id="services" label="Services you provide" error={errors.services}>
        <div className="grid grid-cols-2 gap-2">
          {JOB_CATEGORIES.map((c) => (
            <label key={c} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
              <input type="checkbox" name="services" value={c} className="size-4 accent-primary" />
              {CATEGORY_LABELS[c]}
            </label>
          ))}
        </div>
      </FormField>

      <FormField
        id="description"
        label="About your company (optional)"
        hint="Freelancers and other companies see this."
        error={errors.description}
      >
        <Textarea id="description" name="description" rows={3} defaultValue={v("description")} />
      </FormField>

      {state.message && (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}

      <Button type="submit" className="h-11 w-full" disabled={pending}>
        {pending ? "Setting up…" : "Create company account"}
      </Button>
    </form>
  );
}
