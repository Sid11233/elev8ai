"use client";

import { ExternalLink, FileText, Paperclip, Trash2 } from "lucide-react";
import { useActionState, useState, useTransition } from "react";

import { FormField } from "@/components/form-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { addJobFileAsset, addJobLink, deleteJobAsset, type AssetField } from "@/lib/job-asset-actions";
import { createClient } from "@/lib/supabase/client";
import type { FormState } from "@/lib/validation/form-state";

type Asset = {
  id: string;
  kind: string;
  role: string;
  label: string | null;
  url: string | null;
  domain: string | null;
  link_status: string;
  scan_status: string;
};

const MAX = 50 * 1024 * 1024;

export function AssetsManager({ jobId, assets }: { jobId: string; assets: Asset[] }) {
  const [state, formAction, pending] = useActionState<FormState<AssetField>, FormData>(
    addJobLink.bind(null, jobId),
    {},
  );
  const [role, setRole] = useState<"source" | "reference">("reference");
  const [fileRole, setFileRole] = useState<"source" | "reference">("reference");
  const [uploading, setUploading] = useState(false);
  const [fileErr, setFileErr] = useState<string | null>(null);
  const [del, startDel] = useTransition();

  async function onFile(file: File | null) {
    if (!file) return;
    setFileErr(null);
    if (file.size > MAX) {
      setFileErr("File is larger than 50 MB.");
      return;
    }
    setUploading(true);
    const supabase = createClient();
    const path = `${jobId}/${Date.now()}-${file.name.replace(/[^a-z0-9.]+/gi, "-").slice(-50)}`;
    const { error } = await supabase.storage.from("job-assets").upload(path, file, {
      contentType: file.type,
    });
    if (error) {
      setUploading(false);
      setFileErr("Upload failed. Try again.");
      return;
    }
    const res = await addJobFileAsset(jobId, {
      path,
      label: file.name,
      role: fileRole,
      mime: file.type,
      size: file.size,
    });
    setUploading(false);
    if (res && !res.ok) setFileErr(res.message ?? "Couldn't save the asset.");
  }

  return (
    <div className="space-y-4">
      {assets.length > 0 && (
        <ul className="space-y-2">
          {assets.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <div className="flex min-w-0 items-center gap-2">
                {a.kind === "link" ? (
                  <ExternalLink className="size-4 shrink-0 text-muted-foreground" />
                ) : (
                  <FileText className="size-4 shrink-0 text-muted-foreground" />
                )}
                <span className="min-w-0 truncate text-sm">{a.label || a.url || a.domain}</span>
                <Badge variant="secondary">{a.role}</Badge>
                {a.link_status !== "ok" && a.kind === "link" && (
                  <Badge className="border-0 bg-destructive/15 text-destructive">{a.link_status}</Badge>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive"
                disabled={del}
                onClick={() => startDel(() => void deleteJobAsset(a.id, jobId))}
              >
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="rounded-lg border p-3">
        <p className="mb-2 text-sm font-medium">Add a file</p>
        <div className="flex flex-wrap items-end gap-2">
          <NativeSelect
            aria-label="File role"
            value={fileRole}
            onChange={(e) => setFileRole(e.target.value as typeof fileRole)}
            className="h-11 max-w-[10rem]"
          >
            <option value="reference">Reference</option>
            <option value="source">Source</option>
          </NativeSelect>
          <Input type="file" disabled={uploading} onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
        </div>
        {uploading && <p className="pt-1 text-xs text-muted-foreground">Uploading…</p>}
        {fileErr && <p className="pt-1 text-xs text-destructive">{fileErr}</p>}
      </div>

      <form action={formAction} className="rounded-lg border p-3">
        <p className="mb-2 flex items-center gap-1.5 text-sm font-medium">
          <Paperclip className="size-3.5" /> Add a link
        </p>
        <div className="space-y-2">
          <FormField id="asset-url" label="URL (allowlisted domains only)" error={state.fieldErrors?.url}>
            <Input id="asset-url" name="url" placeholder="https://" className="h-11" />
          </FormField>
          <FormField id="asset-label" label="Label (optional)">
            <Input id="asset-label" name="label" className="h-11" />
          </FormField>
          <input type="hidden" name="role" value={role} />
          <NativeSelect
            aria-label="Link role"
            value={role}
            onChange={(e) => setRole(e.target.value as typeof role)}
            className="h-11 max-w-[10rem]"
          >
            <option value="reference">Reference</option>
            <option value="source">Source</option>
          </NativeSelect>
          {state.message === "ok" && (
            <Alert>
              <AlertDescription>Link added.</AlertDescription>
            </Alert>
          )}
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Checking…" : "Add link"}
          </Button>
        </div>
      </form>
    </div>
  );
}
