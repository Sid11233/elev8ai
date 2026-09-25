"use client";

import { Paperclip, X } from "lucide-react";
import { type FormEvent, startTransition, useActionState, useState } from "react";

import { FormField } from "@/components/form-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import type { FormState } from "@/lib/validation/form-state";
import {
  SUBMISSION_FILE_MAX_BYTES,
  SUBMISSION_FILE_TYPES,
  SUBMISSION_MAX_FILES,
  type SubmissionField,
} from "@/lib/validation/submission";

import { submitWork } from "../actions";

type Props = {
  applicationId: string;
  userId: string;
  unitLabel: string | null; // set for per-unit jobs
  maxUnits: number | null;
};

function safeFileName(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "-")
    .slice(-80);
}

export function SubmitWorkForm({ applicationId, userId, unitLabel, maxUnits }: Props) {
  const [state, formAction, pending] = useActionState<FormState<SubmissionField>, FormData>(
    submitWork.bind(null, applicationId, { perUnit: !!unitLabel }),
    {},
  );
  const [files, setFiles] = useState<File[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const errors = state.fieldErrors ?? {};
  const busy = pending || uploading;

  function addFiles(list: FileList | null) {
    setUploadError(null);
    const picked = Array.from(list ?? []);
    const bad = picked.find(
      (f) =>
        !(SUBMISSION_FILE_TYPES as readonly string[]).includes(f.type) ||
        f.size > SUBMISSION_FILE_MAX_BYTES,
    );
    if (bad) {
      setUploadError(`${bad.name}: use JPG, PNG, WebP or PDF files up to 10 MB.`);
      return;
    }
    setFiles((prev) => [...prev, ...picked].slice(0, SUBMISSION_MAX_FILES));
  }

  // Files go straight from the browser to the private bucket (the storage
  // policy only allows this user's folder for an accepted application); the
  // server action then receives just the paths.
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setUploadError(null);

    const paths: string[] = [];
    if (files.length) {
      setUploading(true);
      const supabase = createClient();
      for (const file of files) {
        const path = `${userId}/${applicationId}/${Date.now()}-${safeFileName(file.name)}`;
        const { error } = await supabase.storage
          .from("submissions")
          .upload(path, file, { contentType: file.type });
        if (error) {
          setUploading(false);
          setUploadError(`Couldn't upload ${file.name}. Please try again.`);
          return;
        }
        paths.push(path);
      }
      setUploading(false);
    }

    formData.set("file_paths", JSON.stringify(paths));
    startTransition(() => formAction(formData));
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <FormField
        id="links"
        label="Links"
        hint="One per line, e.g. the posted clip or a shared drive folder."
        error={errors.links}
      >
        <Textarea
          id="links"
          name="links"
          rows={3}
          placeholder="https://"
          defaultValue={state.values?.links ?? ""}
          aria-invalid={!!errors.links}
        />
      </FormField>

      <FormField
        id="files"
        label="Files (optional)"
        hint="Screenshots or PDFs, up to 10 MB each."
        error={uploadError ?? errors.files}
      >
        <Input
          id="files"
          type="file"
          multiple
          accept={SUBMISSION_FILE_TYPES.join(",")}
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        {files.length > 0 && (
          <ul className="space-y-1 pt-1">
            {files.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex items-center gap-2 text-sm">
                <Paperclip className="size-3.5 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{f.name}</span>
                <button
                  type="button"
                  aria-label={`Remove ${f.name}`}
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                >
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </FormField>

      {unitLabel && (
        <FormField
          id="units"
          label={`How many ${unitLabel}s did you complete?`}
          hint={maxUnits ? `Paid up to ${maxUnits}.` : undefined}
          error={errors.units}
        >
          <Input
            id="units"
            name="units"
            inputMode="numeric"
            defaultValue={state.values?.units ?? ""}
            aria-invalid={!!errors.units}
            className="h-11 max-w-40"
          />
        </FormField>
      )}

      <FormField id="notes" label="Notes (optional)" error={errors.notes}>
        <Textarea
          id="notes"
          name="notes"
          rows={3}
          maxLength={2000}
          defaultValue={state.values?.notes ?? ""}
        />
      </FormField>

      {state.message && (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}

      <Button type="submit" className="h-11 w-full sm:w-auto sm:px-8" disabled={busy}>
        {uploading ? "Uploading files…" : pending ? "Submitting…" : "Submit work"}
      </Button>
    </form>
  );
}
