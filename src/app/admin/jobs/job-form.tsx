"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { FormField } from "@/components/form-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { isoToLocalInput } from "@/lib/datetime";
import { submitWithoutReset } from "@/lib/forms";
import { CATEGORY_LABELS, type Company, type Job, JOB_CATEGORIES, type Skill } from "@/lib/jobs";
import { centsToInput, formatPay, formatPayCap, parseMoneyToCents } from "@/lib/money";
import type { FormState } from "@/lib/validation/form-state";
import type { JobField } from "@/lib/validation/job";

import { saveJob } from "./actions";

type Props = {
  job?: Job;
  companies: Pick<Company, "id" | "name">[];
  skills: Pick<Skill, "id" | "name">[];
};

export function JobForm({ job, companies, skills }: Props) {
  const [state, formAction, pending] = useActionState<FormState<JobField>, FormData>(
    saveJob.bind(null, job?.id ?? null),
    {},
  );
  const errors = state.fieldErrors ?? {};

  const initial: Record<JobField, string> = {
    company_id: job?.company_id ?? "",
    title: job?.title ?? "",
    description: job?.description ?? "",
    category: job?.category ?? "",
    pay: job ? centsToInput(job.pay_cents) : "",
    pay_type: job?.pay_type ?? "fixed",
    unit_label: job?.unit_label ?? "",
    max_units: job?.max_units?.toString() ?? "",
    slots: job?.slots.toString() ?? "1",
    required_skill_id: job?.required_skill_id ?? "",
    deadline: isoToLocalInput(job?.deadline ?? null),
    proof_instructions: job?.proof_instructions ?? "",
  };
  const value = (key: JobField) => state.values?.[key] ?? initial[key];

  // Live pay preview, e.g. "$5 per clip · max 20 clips · up to $100".
  const [pay, setPay] = useState(value("pay"));
  const [payType, setPayType] = useState(value("pay_type"));
  const [unit, setUnit] = useState(value("unit_label"));
  const [maxUnits, setMaxUnits] = useState(value("max_units"));
  const payCents = parseMoneyToCents(pay);
  const previewJob = {
    pay_cents: payCents ?? 0,
    pay_type: payType,
    unit_label: unit.trim() || null,
    max_units: /^\d+$/.test(maxUnits) ? Number(maxUnits) : null,
  };
  const preview = payCents
    ? [formatPay(previewJob), formatPayCap(previewJob)].filter(Boolean).join(" · ")
    : null;

  const status = job?.status ?? "draft";

  return (
    <form onSubmit={submitWithoutReset(formAction)} className="max-w-2xl space-y-5" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="company_id" label="Company" error={errors.company_id}>
          <NativeSelect
            id="company_id"
            name="company_id"
            defaultValue={value("company_id")}
            aria-invalid={!!errors.company_id}
          >
            <option value="">Choose a company</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </NativeSelect>
        </FormField>

        <FormField id="category" label="Category" error={errors.category}>
          <NativeSelect
            id="category"
            name="category"
            defaultValue={value("category")}
            aria-invalid={!!errors.category}
          >
            <option value="">Choose a category</option>
            {JOB_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </NativeSelect>
        </FormField>
      </div>

      <FormField id="title" label="Title" error={errors.title}>
        <Input
          id="title"
          name="title"
          placeholder="e.g. Clip our latest podcast episode"
          defaultValue={value("title")}
          aria-invalid={!!errors.title}
          className="h-11"
        />
      </FormField>

      <FormField id="description" label="Description" error={errors.description}>
        <Textarea
          id="description"
          name="description"
          rows={5}
          defaultValue={value("description")}
          aria-invalid={!!errors.description}
        />
      </FormField>

      <fieldset className="space-y-4 rounded-xl border p-4">
        <legend className="px-1 text-sm font-medium">Pay</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="pay_type" label="Pay type" error={errors.pay_type}>
            <NativeSelect
              id="pay_type"
              name="pay_type"
              value={payType}
              onChange={(e) => setPayType(e.target.value)}
            >
              <option value="fixed">Fixed amount for the job</option>
              <option value="per_unit">Per unit (e.g. per clip)</option>
            </NativeSelect>
          </FormField>

          <FormField
            id="pay"
            label={payType === "per_unit" ? "Pay per unit (USD)" : "Pay (USD)"}
            error={errors.pay}
          >
            <Input
              id="pay"
              name="pay"
              inputMode="decimal"
              placeholder="5.00"
              value={pay}
              onChange={(e) => setPay(e.target.value)}
              aria-invalid={!!errors.pay}
              className="h-11"
            />
          </FormField>
        </div>

        {payType === "per_unit" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              id="unit_label"
              label="Unit"
              hint="Singular, e.g. clip, meeting, video"
              error={errors.unit_label}
            >
              <Input
                id="unit_label"
                name="unit_label"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                aria-invalid={!!errors.unit_label}
                className="h-11"
              />
            </FormField>
            <FormField id="max_units" label="Max units paid per person" error={errors.max_units}>
              <Input
                id="max_units"
                name="max_units"
                inputMode="numeric"
                value={maxUnits}
                onChange={(e) => setMaxUnits(e.target.value)}
                aria-invalid={!!errors.max_units}
                className="h-11"
              />
            </FormField>
          </div>
        )}

        {preview && (
          <p className="text-sm">
            Talent will see: <span className="font-medium text-primary">{preview}</span>
          </p>
        )}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-3">
        <FormField
          id="slots"
          label="Spots"
          hint="How many people you'll accept"
          error={errors.slots}
        >
          <Input
            id="slots"
            name="slots"
            inputMode="numeric"
            defaultValue={value("slots")}
            aria-invalid={!!errors.slots}
            className="h-11"
          />
        </FormField>

        <FormField
          id="deadline"
          label="Deadline (optional)"
          hint="Mauritius time"
          error={errors.deadline}
        >
          <Input
            id="deadline"
            name="deadline"
            type="datetime-local"
            defaultValue={value("deadline")}
            aria-invalid={!!errors.deadline}
            className="h-11"
          />
        </FormField>

        <FormField id="required_skill_id" label="Who can apply" error={errors.required_skill_id}>
          <NativeSelect
            id="required_skill_id"
            name="required_skill_id"
            defaultValue={value("required_skill_id")}
          >
            <option value="">Open to everyone</option>
            {skills.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} badge required
              </option>
            ))}
          </NativeSelect>
        </FormField>
      </div>

      <FormField
        id="proof_instructions"
        label="Proof instructions"
        hint="Exactly what to submit, e.g. posted link plus a views screenshot after 48 hours."
        error={errors.proof_instructions}
      >
        <Textarea
          id="proof_instructions"
          name="proof_instructions"
          rows={4}
          defaultValue={value("proof_instructions")}
          aria-invalid={!!errors.proof_instructions}
        />
      </FormField>

      {state.message && (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap gap-3">
        {status === "draft" ? (
          // "Save draft" comes first: pressing Enter uses the first submit button,
          // and that should never publish a job by accident.
          <>
            <Button
              type="submit"
              name="intent"
              value="draft"
              variant="outline"
              className="h-11"
              disabled={pending}
            >
              Save draft
            </Button>
            <Button
              type="submit"
              name="intent"
              value="publish"
              className="h-11 px-6"
              disabled={pending}
            >
              Publish
            </Button>
          </>
        ) : (
          <>
            <Button
              type="submit"
              name="intent"
              value="save"
              className="h-11 px-6"
              disabled={pending}
            >
              Save changes
            </Button>
            {status === "closed" && (
              <Button
                type="submit"
                name="intent"
                value="publish"
                variant="outline"
                className="h-11"
                disabled={pending}
              >
                Save and reopen
              </Button>
            )}
          </>
        )}
        <Button asChild variant="ghost" className="h-11">
          <Link href="/admin/jobs">Cancel</Link>
        </Button>
      </div>
    </form>
  );
}
