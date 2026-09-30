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

import { type CompanyProfileField, saveCompanyProfile } from "./actions";

const TYPES = ["Agency", "Studio", "Brand", "Freelance team", "Other"];

type Defaults = {
  name: string;
  type: string;
  phone: string;
  website: string;
  description: string;
  services: string[];
};

export function CompanyProfileForm({ defaults }: { defaults: Defaults }) {
  const [state, formAction, pending] = useActionState<FormState<CompanyProfileField>, FormData>(
    saveCompanyProfile,
    {},
  );
  const errors = state.fieldErrors ?? {};
  const saved = state.message === "ok";
  const v = (k: CompanyProfileField) => state.values?.[k] ?? defaults[k as keyof Defaults] ?? "";

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <FormField id="name" label="Company name" error={errors.name}>
        <Input id="name" name="name" required defaultValue={v("name")} className="h-11" />
      </FormField>

      <FormField id="type" label="Type of company" error={errors.type}>
        <NativeSelect id="type" name="type" defaultValue={String(v("type")) || "Agency"}>
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

      <FormField id="website" label="Website (optional)" error={errors.website}>
        <Input
          id="website"
          name="website"
          type="url"
          placeholder="https://…"
          defaultValue={v("website")}
          className="h-11"
        />
      </FormField>

      <FormField id="services" label="Services you provide" error={errors.services}>
        <div className="grid grid-cols-2 gap-2">
          {JOB_CATEGORIES.map((c) => (
            <label key={c} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
              <input
                type="checkbox"
                name="services"
                value={c}
                defaultChecked={defaults.services.includes(c)}
                className="size-4 accent-primary"
              />
              {CATEGORY_LABELS[c]}
            </label>
          ))}
        </div>
      </FormField>

      <FormField
        id="description"
        label="About your company"
        hint="Freelancers and other companies see this when you post or apply."
        error={errors.description}
      >
        <Textarea id="description" name="description" rows={4} defaultValue={v("description")} />
      </FormField>

      {state.message && state.message !== "ok" && (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}
      {saved && (
        <Alert>
          <AlertDescription>Saved.</AlertDescription>
        </Alert>
      )}

      <Button type="submit" className="h-11 w-full" disabled={pending}>
        {pending ? "Saving…" : "Save profile"}
      </Button>
    </form>
  );
}
