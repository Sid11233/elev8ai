"use client";

import { CheckCircle2, Clock, Paperclip, XCircle } from "lucide-react";
import { type FormEvent, startTransition, useActionState, useState } from "react";

import { submitAssignment } from "@/app/app/learn/[slug]/assignment-actions";
import { FormField } from "@/components/form-field";
import { Markdown } from "@/components/markdown";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { CourseAssignment } from "@/lib/courses";
import { createClient } from "@/lib/supabase/client";
import type { FormState } from "@/lib/validation/form-state";
import { SUBMISSION_FILE_TYPES, type SubmissionField } from "@/lib/validation/submission";

const MAX = 10 * 1024 * 1024;

export function AssignmentSection({
  courseId,
  slug,
  userId,
  brief,
  latest,
  canSubmit,
}: {
  courseId: string;
  slug: string;
  userId: string;
  brief: string;
  latest: CourseAssignment | null;
  canSubmit: boolean;
}) {
  const [state, formAction, pending] = useActionState<FormState<SubmissionField>, FormData>(
    submitAssignment.bind(null, courseId, slug),
    {},
  );
  const [files, setFiles] = useState<File[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const errors = state.fieldErrors ?? {};

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setUploadError(null);
    const paths: string[] = [];
    if (files.length) {
      setUploading(true);
      const supabase = createClient();
      for (const file of files) {
        const path = `${userId}/${courseId}/${Date.now()}-${file.name.replace(/[^a-z0-9.]+/gi, "-").slice(-60)}`;
        const { error } = await supabase.storage
          .from("assignment-files")
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">Assignment</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg bg-secondary/60 p-3">
          <Markdown>{brief}</Markdown>
        </div>

        {latest?.status === "passed" && (
          <Alert>
            <AlertDescription className="flex items-center gap-2 text-primary">
              <CheckCircle2 className="size-4" /> Passed — badge earned. Nice work!
            </AlertDescription>
          </Alert>
        )}
        {latest?.status === "pending" && (
          <Alert>
            <AlertDescription className="flex items-center gap-2">
              <Clock className="size-4" /> Submitted. We&apos;ll grade it within 72 hours.
            </AlertDescription>
          </Alert>
        )}
        {latest?.status === "failed" && (
          <Alert variant="destructive">
            <AlertDescription>
              <span className="flex items-center gap-2 font-medium">
                <XCircle className="size-4" /> Not passed yet
              </span>
              {latest.feedback && (
                <span className="mt-1 block whitespace-pre-line">{latest.feedback}</span>
              )}
            </AlertDescription>
          </Alert>
        )}

        {canSubmit && (
          <form onSubmit={onSubmit} className="space-y-3" noValidate>
            <FormField id="a-links" label="Links" hint="One per line." error={errors.links}>
              <Textarea
                id="a-links"
                name="links"
                rows={2}
                placeholder="https://"
                defaultValue={state.values?.links ?? ""}
              />
            </FormField>
            <FormField id="a-files" label="Files (optional)" error={uploadError ?? errors.files}>
              <Input
                id="a-files"
                type="file"
                multiple
                accept={SUBMISSION_FILE_TYPES.join(",")}
                onChange={(e) => {
                  const picked = Array.from(e.target.files ?? []);
                  const allowed = SUBMISSION_FILE_TYPES as readonly string[];
                  const bad = picked.find((f) => !allowed.includes(f.type) || f.size > MAX);
                  if (bad) setUploadError("JPG, PNG, WebP or PDF up to 10 MB.");
                  else {
                    setUploadError(null);
                    setFiles((prev) => [...prev, ...picked].slice(0, 10));
                  }
                  e.target.value = "";
                }}
              />
              {files.length > 0 && (
                <ul className="pt-1">
                  {files.map((f, i) => (
                    <li key={i} className="flex items-center gap-1.5 text-sm">
                      <Paperclip className="size-3.5 text-muted-foreground" />
                      {f.name}
                    </li>
                  ))}
                </ul>
              )}
            </FormField>
            <FormField id="a-notes" label="Notes (optional)" error={errors.notes}>
              <Textarea
                id="a-notes"
                name="notes"
                rows={2}
                maxLength={2000}
                defaultValue={state.values?.notes ?? ""}
              />
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
              {uploading
                ? "Uploading…"
                : pending
                  ? "Submitting…"
                  : latest?.status === "failed"
                    ? "Resubmit"
                    : "Submit assignment"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
