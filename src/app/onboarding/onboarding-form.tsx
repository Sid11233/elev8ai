"use client";

import { useActionState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { completeOnboarding, type OnboardingState } from "./actions";

type Defaults = { full_name?: string | null; country?: string | null };

const COUNTRIES = [
  "Mauritius",
  "South Africa",
  "India",
  "France",
  "United Kingdom",
  "United States",
  "Madagascar",
  "Réunion",
];

export function OnboardingForm({
  defaults,
  maxBirthDate,
}: {
  defaults: Defaults;
  maxBirthDate: string;
}) {
  const [state, formAction, pending] = useActionState<OnboardingState, FormData>(
    completeOnboarding,
    {},
  );
  const values = state.values;
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <Field id="full_name" label="Full name" error={errors.full_name}>
        <Input
          id="full_name"
          name="full_name"
          autoComplete="name"
          required
          defaultValue={values?.full_name ?? defaults.full_name ?? ""}
          aria-invalid={!!errors.full_name}
          className="h-11"
        />
      </Field>

      <Field
        id="username"
        label="Username"
        hint="Letters, numbers and underscores."
        error={errors.username}
      >
        <Input
          id="username"
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          required
          defaultValue={values?.username ?? ""}
          aria-invalid={!!errors.username}
          className="h-11"
        />
      </Field>

      <Field id="date_of_birth" label="Date of birth" error={errors.date_of_birth}>
        <Input
          id="date_of_birth"
          name="date_of_birth"
          type="date"
          autoComplete="bday"
          max={maxBirthDate}
          required
          defaultValue={values?.date_of_birth ?? ""}
          aria-invalid={!!errors.date_of_birth}
          className="h-11"
        />
      </Field>

      <Field id="country" label="Country" error={errors.country}>
        <Input
          id="country"
          name="country"
          list="countries"
          autoComplete="country-name"
          required
          defaultValue={values?.country ?? defaults.country ?? ""}
          aria-invalid={!!errors.country}
          className="h-11"
        />
        <datalist id="countries">
          {COUNTRIES.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </Field>

      <Field id="phone" label="Phone (optional)" error={errors.phone}>
        <Input
          id="phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          placeholder="+230 5xxx xxxx"
          defaultValue={values?.phone ?? ""}
          aria-invalid={!!errors.phone}
          className="h-11"
        />
      </Field>

      <Field id="bio" label="Short bio (optional)" hint="What are you good at?" error={errors.bio}>
        <Textarea
          id="bio"
          name="bio"
          rows={3}
          maxLength={500}
          defaultValue={values?.bio ?? ""}
          aria-invalid={!!errors.bio}
        />
      </Field>

      <Field
        id="avatar"
        label="Profile photo (optional)"
        hint="JPG, PNG or WebP, up to 2 MB."
        error={errors.avatar}
      >
        <Input
          id="avatar"
          name="avatar"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          aria-invalid={!!errors.avatar}
        />
      </Field>

      {state.message && (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}

      <Button type="submit" className="h-11 w-full" disabled={pending}>
        {pending ? "Saving…" : "Finish setup"}
      </Button>
    </form>
  );
}

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : (
        hint && <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}
