"use client";

import { Eye, EyeOff, Paperclip, Trash2 } from "lucide-react";
import { type FormEvent, startTransition, useActionState, useState, useTransition } from "react";

import { FormField } from "@/components/form-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { createClient } from "@/lib/supabase/client";
import type { FormState } from "@/lib/validation/form-state";

import {
  addExternalCertificate,
  addPortfolioItem,
  deletePortfolioItem,
  type PortfolioField,
  setPortfolioVisibility,
} from "./actions";

const FILE_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX = 10 * 1024 * 1024;

export function AddPortfolioForm({ userId }: { userId: string }) {
  const [state, formAction, pending] = useActionState<FormState<PortfolioField>, FormData>(
    addPortfolioItem,
    {},
  );
  const [kind, setKind] = useState<"image" | "pdf" | "link">("image");
  const [file, setFile] = useState<File | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const errors = state.fieldErrors ?? {};

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("kind", kind);
    setErr(null);
    if (kind !== "link") {
      if (!file) {
        setErr("Choose a file.");
        return;
      }
      setUploading(true);
      const supabase = createClient();
      const path = `${userId}/${Date.now()}-${file.name.replace(/[^a-z0-9.]+/gi, "-").slice(-50)}`;
      const { error } = await supabase.storage.from("portfolio").upload(path, file, {
        contentType: file.type,
      });
      setUploading(false);
      if (error) {
        setErr("Upload failed. Try again.");
        return;
      }
      fd.set("file_path", path);
    }
    startTransition(() => formAction(fd));
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <FormField id="pf-kind" label="Type">
        <NativeSelect
          id="pf-kind"
          value={kind}
          onChange={(e) => setKind(e.target.value as typeof kind)}
        >
          <option value="image">Image</option>
          <option value="pdf">PDF</option>
          <option value="link">Link</option>
        </NativeSelect>
      </FormField>
      <FormField id="pf-title" label="Title (optional)">
        <Input id="pf-title" name="title" className="h-11" />
      </FormField>
      {kind === "link" ? (
        <FormField id="pf-url" label="URL" error={errors.url}>
          <Input id="pf-url" name="url" placeholder="https://" className="h-11" />
        </FormField>
      ) : (
        <FormField
          id="pf-file"
          label="File"
          hint="Companies see a watermarked preview, never your original."
          error={err ?? errors.file}
        >
          <Input
            id="pf-file"
            type="file"
            accept={FILE_TYPES.join(",")}
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              if (f && (!FILE_TYPES.includes(f.type) || f.size > MAX)) {
                setErr("JPG, PNG, WebP or PDF up to 10 MB.");
                setFile(null);
              } else {
                setErr(null);
                setFile(f);
              }
            }}
          />
          {file && (
            <p className="flex items-center gap-1.5 pt-1 text-sm">
              <Paperclip className="size-3.5 text-muted-foreground" />
              {file.name}
            </p>
          )}
        </FormField>
      )}
      {state.message && state.message !== "ok" && (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}
      {state.message === "ok" && (
        <Alert>
          <AlertDescription>Added.</AlertDescription>
        </Alert>
      )}
      <Button type="submit" size="sm" disabled={pending || uploading}>
        {uploading ? "Uploading…" : pending ? "Adding…" : "Add to portfolio"}
      </Button>
    </form>
  );
}

export function PortfolioItemActions({
  id,
  visibility,
}: {
  id: string;
  visibility: string;
}) {
  const [pending, start] = useTransition();
  const shared = visibility === "companies";
  return (
    <div className="flex gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() =>
          start(() => void setPortfolioVisibility(id, shared ? "private" : "companies"))
        }
      >
        {shared ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
        {shared ? "Shared" : "Private"}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-destructive"
        disabled={pending}
        onClick={() => start(() => void deletePortfolioItem(id))}
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}

export function AddCertificateForm({ userId }: { userId: string }) {
  const [state, formAction, pending] = useActionState<FormState<"title" | "file">, FormData>(
    addExternalCertificate,
    {},
  );
  const [file, setFile] = useState<File | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const errors = state.fieldErrors ?? {};

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setErr(null);
    if (!file) {
      setErr("Choose a file.");
      return;
    }
    setUploading(true);
    const supabase = createClient();
    const path = `${userId}/${Date.now()}-${file.name.replace(/[^a-z0-9.]+/gi, "-").slice(-50)}`;
    const { error } = await supabase.storage.from("certificates").upload(path, file, {
      contentType: file.type,
    });
    setUploading(false);
    if (error) {
      setErr("Upload failed. Try again.");
      return;
    }
    fd.set("file_path", path);
    startTransition(() => formAction(fd));
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <FormField id="cert-title" label="Certificate title" error={errors.title}>
        <Input id="cert-title" name="title" className="h-11" />
      </FormField>
      <FormField id="cert-issuer" label="Issuer (optional)">
        <Input id="cert-issuer" name="issuer" className="h-11" />
      </FormField>
      <FormField id="cert-file" label="File" error={err ?? errors.file}>
        <Input
          id="cert-file"
          type="file"
          accept={FILE_TYPES.join(",")}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </FormField>
      {state.message === "ok" ? (
        <Alert>
          <AlertDescription>Uploaded — shown as Unverified until an admin checks it.</AlertDescription>
        </Alert>
      ) : (
        state.message && (
          <Alert variant="destructive">
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        )
      )}
      <Button type="submit" size="sm" disabled={pending || uploading}>
        {uploading ? "Uploading…" : pending ? "Saving…" : "Upload certificate"}
      </Button>
    </form>
  );
}
