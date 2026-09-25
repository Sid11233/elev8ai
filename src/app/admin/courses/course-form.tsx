"use client";

import Link from "next/link";
import { useActionState } from "react";

import { FormField } from "@/components/form-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { submitWithoutReset } from "@/lib/forms";
import type { Course } from "@/lib/courses";
import { centsToInput } from "@/lib/money";
import type { CourseField } from "@/lib/validation/course";
import type { FormState } from "@/lib/validation/form-state";

import { saveCourse } from "./actions";

export function CourseForm({
  course,
  skills,
}: {
  course?: Course;
  skills: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState<FormState<CourseField>, FormData>(
    saveCourse.bind(null, course?.id ?? null),
    {},
  );
  const errors = state.fieldErrors ?? {};
  const v = (k: CourseField, fallback = "") => state.values?.[k] ?? fallback;
  const published = course?.published ?? false;

  return (
    <form onSubmit={submitWithoutReset(formAction)} className="max-w-xl space-y-4" noValidate>
      <FormField id="title" label="Title" error={errors.title}>
        <Input
          id="title"
          name="title"
          required
          defaultValue={v("title", course?.title)}
          className="h-11"
        />
      </FormField>

      <FormField
        id="slug"
        label="Slug"
        hint="Leave blank to generate from the title."
        error={errors.slug}
      >
        <Input
          id="slug"
          name="slug"
          autoCapitalize="none"
          defaultValue={v("slug", course?.slug)}
          className="h-11"
        />
      </FormField>

      <FormField id="description" label="Description" error={errors.description}>
        <Textarea
          id="description"
          name="description"
          rows={4}
          defaultValue={v("description", course?.description ?? "")}
        />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="price" label="Price (USD)" hint="Use 0 for free." error={errors.price}>
          <Input
            id="price"
            name="price"
            inputMode="decimal"
            placeholder="12.00"
            defaultValue={v("price", course ? centsToInput(course.price_cents) : "")}
            className="h-11"
          />
        </FormField>

        <FormField id="skill_id" label="Badge awarded" error={errors.skill_id}>
          <NativeSelect
            id="skill_id"
            name="skill_id"
            defaultValue={v("skill_id", course?.skill_id ?? "")}
          >
            <option value="">No badge</option>
            {skills.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </NativeSelect>
        </FormField>
      </div>

      <FormField
        id="lemon_variant_id"
        label="Lemon Squeezy variant id"
        hint="From your Lemon Squeezy product variant. Required to publish."
        error={errors.lemon_variant_id}
      >
        <Input
          id="lemon_variant_id"
          name="lemon_variant_id"
          defaultValue={v("lemon_variant_id", course?.lemon_variant_id ?? "")}
          className="h-11"
        />
      </FormField>

      {state.message && (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap gap-3">
        {published ? (
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
            <Button
              type="submit"
              name="intent"
              value="draft"
              variant="outline"
              className="h-11"
              disabled={pending}
            >
              Unpublish
            </Button>
          </>
        ) : (
          <>
            <Button
              type="submit"
              name="intent"
              value="draft"
              variant="outline"
              className="h-11"
              disabled={pending}
            >
              {course ? "Save draft" : "Create draft"}
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
        )}
        <Button asChild variant="ghost" className="h-11">
          <Link href="/admin/courses">Cancel</Link>
        </Button>
      </div>
    </form>
  );
}
