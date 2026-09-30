"use client";

import Link from "next/link";
import { useActionState } from "react";

import { FormField } from "@/components/form-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Profile } from "@/lib/auth";
import { submitWithoutReset } from "@/lib/forms";
import type { FormState } from "@/lib/validation/form-state";
import type { ProfileEditField } from "@/lib/validation/profile";

import { saveProfile } from "./actions";

export function ProfileEditForm({ profile }: { profile: Profile }) {
  const [state, formAction, pending] = useActionState<FormState<ProfileEditField>, FormData>(
    saveProfile,
    {},
  );
  const errors = state.fieldErrors ?? {};
  const v = (k: ProfileEditField, fallback: string | null | undefined) =>
    state.values?.[k] ?? fallback ?? "";
  const saved = state.message === "ok";

  return (
    <form onSubmit={submitWithoutReset(formAction)} className="max-w-xl space-y-4" noValidate>
      <FormField
        id="headline"
        label="Headline"
        hint="A short tagline, e.g. 'Short-form video editor & clipper'."
        error={errors.headline}
      >
        <Input
          id="headline"
          name="headline"
          defaultValue={v("headline", profile.headline)}
          className="h-11"
        />
      </FormField>

      <FormField
        id="about"
        label="About you"
        hint="Your story — experience, what you're great at, what you're looking for."
        error={errors.about}
      >
        <Textarea id="about" name="about" rows={6} defaultValue={v("about", profile.about)} />
      </FormField>

      <FormField id="bio" label="Short bio" error={errors.bio}>
        <Textarea
          id="bio"
          name="bio"
          rows={2}
          maxLength={500}
          defaultValue={v("bio", profile.bio)}
        />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="country" label="Country" error={errors.country}>
          <Input
            id="country"
            name="country"
            required
            defaultValue={v("country", profile.country)}
            className="h-11"
          />
        </FormField>
        <FormField id="phone" label="Phone (optional)" error={errors.phone}>
          <Input
            id="phone"
            name="phone"
            type="tel"
            defaultValue={v("phone", profile.phone)}
            className="h-11"
          />
        </FormField>
      </div>

      {saved && (
        <Alert>
          <AlertDescription className="text-primary">Profile saved.</AlertDescription>
        </Alert>
      )}
      {state.message && !saved && (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}

      <div className="flex gap-3">
        <Button type="submit" className="h-11 px-6" disabled={pending}>
          {pending ? "Saving…" : "Save profile"}
        </Button>
        <Button asChild variant="ghost" className="h-11">
          <Link href="/app/profile">Done</Link>
        </Button>
      </div>
    </form>
  );
}
