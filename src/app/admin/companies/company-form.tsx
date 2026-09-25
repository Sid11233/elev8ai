"use client";

import Link from "next/link";
import { useActionState } from "react";

import { CompanyLogo } from "@/components/company-logo";
import { FormField } from "@/components/form-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { submitWithoutReset } from "@/lib/forms";
import type { Company } from "@/lib/jobs";
import type { CompanyField } from "@/lib/validation/company";
import type { FormState } from "@/lib/validation/form-state";

import { saveCompany } from "./actions";

export function CompanyForm({ company }: { company?: Company }) {
  const [state, formAction, pending] = useActionState<FormState<CompanyField>, FormData>(
    saveCompany.bind(null, company?.id ?? null),
    {},
  );
  const errors = state.fieldErrors ?? {};
  const value = (key: "name" | "slug" | "description" | "website") =>
    state.values?.[key] ?? company?.[key] ?? "";

  return (
    <form onSubmit={submitWithoutReset(formAction)} className="max-w-xl space-y-4" noValidate>
      <FormField id="name" label="Name" error={errors.name}>
        <Input id="name" name="name" required defaultValue={value("name")} className="h-11" />
      </FormField>

      <FormField
        id="slug"
        label="Slug"
        hint="Used in links. Leave blank to generate it from the name."
        error={errors.slug}
      >
        <Input
          id="slug"
          name="slug"
          autoCapitalize="none"
          defaultValue={value("slug")}
          className="h-11"
        />
      </FormField>

      <FormField id="website" label="Website (optional)" error={errors.website}>
        <Input
          id="website"
          name="website"
          type="url"
          placeholder="https://"
          defaultValue={value("website")}
          className="h-11"
        />
      </FormField>

      <FormField
        id="description"
        label="Description"
        hint="Shown to talent on job pages."
        error={errors.description}
      >
        <Textarea
          id="description"
          name="description"
          rows={4}
          defaultValue={value("description")}
        />
      </FormField>

      <FormField
        id="logo"
        label="Logo"
        hint="Square JPG, PNG or WebP, up to 2 MB."
        error={errors.logo}
      >
        <div className="flex items-center gap-3">
          {company && (
            <CompanyLogo name={company.name} src={company.logo_url} className="size-12" />
          )}
          <Input id="logo" name="logo" type="file" accept="image/jpeg,image/png,image/webp" />
        </div>
      </FormField>

      {state.message && (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}

      <div className="flex gap-3">
        <Button type="submit" className="h-11 px-6" disabled={pending}>
          {pending ? "Saving…" : company ? "Save changes" : "Create company"}
        </Button>
        <Button asChild variant="ghost" className="h-11">
          <Link href="/admin/companies">Cancel</Link>
        </Button>
      </div>
    </form>
  );
}
