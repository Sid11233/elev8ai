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

import { type ApplyField, applyToJob } from "../actions";

const TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX = 10 * 1024 * 1024;

export function ApplyForm({
  jobId,
  userId,
  action,
}: {
  jobId: string;
  userId: string;
  action?: (prev: FormState<ApplyField>, formData: FormData) => Promise<FormState<ApplyField>>;
}) {
  const [state, formAction, pending] = useActionState<FormState<ApplyField>, FormData>(
    action ?? applyToJob.bind(null, jobId),
    {},
  );
  const [files, setFiles] = useState<File[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const errors = state.fieldErrors ?? {};

  function addFiles(list: FileList | null) {
    setUploadError(null);
    const picked = Array.from(list ?? []);
    const bad = picked.find((f) => !TYPES.includes(f.type) || f.size > MAX);
    if (bad) {
      setUploadError("Use JPG, PNG, WebP or PDF files up to 10 MB.");
      return;
    }
    setFiles((prev) => [...prev, ...picked].slice(0, 10));
  }

  // Upload portfolio files to the applicant's own folder, then apply.
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setUploadError(null);
    const paths: string[] = [];
    if (files.length) {
      setUploading(true);
      const supabase = createClient();
      for (const file of files) {
        const path = `${userId}/${jobId}/${Date.now()}-${file.name.replace(/[^a-z0-9.]+/gi, "-").slice(-60)}`;
        const { error } = await supabase.storage
          .from("application-attachments")
          .upload(path, file, { contentType: file.type });
        if (error) {
          setUploading(false);
          setUploadError(`Couldn't upload ${file.name}. Try again.`);
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
    <form onSubmit={onSubmit} className="space-y-3" noValidate>
      <FormField
        id="pitch"
        label="Why you? (optional)"
        hint="A line or two about relevant experience helps you get picked."
        error={errors.pitch}
      >
        <Textarea
          id="pitch"
          name="pitch"
          rows={3}
          maxLength={1000}
          defaultValue={state.values?.pitch ?? ""}
        />
      </FormField>

      <FormField
        id="links"
        label="Portfolio links (optional)"
        hint="One per line — your work, socials, a reel."
        error={errors.links}
      >
        <Textarea id="links" name="links" rows={2} placeholder="https://" />
      </FormField>

      <FormField
        id="files"
        label="Attachments (optional)"
        hint="Samples of your work — JPG, PNG, WebP or PDF, up to 10 MB each."
        error={uploadError ?? errors.files}
      >
        <Input
          id="files"
          type="file"
          multiple
          accept={TYPES.join(",")}
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

      {state.message && (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}
      <Button
        type="submit"
        className="h-11 w-full sm:w-auto sm:px-8"
        disabled={pending || uploading}
      >
        {uploading ? "Uploading…" : pending ? "Applying…" : "Apply"}
      </Button>
    </form>
  );
}
