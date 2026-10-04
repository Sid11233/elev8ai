"use client";

import { Paperclip } from "lucide-react";
import { type FormEvent, startTransition, useActionState, useState } from "react";

import { FormField } from "@/components/form-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { centsToInput } from "@/lib/money";
import { type ReportField, reportPayment } from "@/lib/payment-actions";
import { createClient } from "@/lib/supabase/client";
import type { FormState } from "@/lib/validation/form-state";

const TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX = 10 * 1024 * 1024;

// Company/admin reports the Juice transfer after paying: transaction id, amount,
// and a proof screenshot. Does not mark anything paid — the freelancer confirms.
export function ReportPaymentForm({
  submissionId,
  reporterUserId,
  amountCents,
}: {
  submissionId: string;
  reporterUserId: string;
  amountCents: number;
}) {
  const [state, formAction, pending] = useActionState<FormState<ReportField>, FormData>(
    reportPayment.bind(null, submissionId),
    {},
  );
  const [file, setFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const errors = state.fieldErrors ?? {};

  if (state.message === "ok") {
    return (
      <Alert>
        <AlertDescription>Payment reported. Waiting for the freelancer to confirm.</AlertDescription>
      </Alert>
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setUploadError(null);
    if (file) {
      setUploading(true);
      const supabase = createClient();
      const path = `${reporterUserId}/report-${Date.now()}-${file.name.replace(/[^a-z0-9.]+/gi, "-").slice(-40)}`;
      const { error } = await supabase.storage
        .from("payment-proofs")
        .upload(path, file, { contentType: file.type });
      setUploading(false);
      if (error) {
        setUploadError("Couldn't upload the proof. Try again.");
        return;
      }
      formData.set("proof_path", path);
    }
    startTransition(() => formAction(formData));
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-xl border p-3">
      <p className="text-sm font-medium">Report your payment</p>
      <FormField id={`txn-${submissionId}`} label="Juice transaction id" error={errors.txn_id}>
        <Input id={`txn-${submissionId}`} name="txn_id" className="h-11" />
      </FormField>
      <FormField id={`amt-${submissionId}`} label="Amount paid (USD)" error={errors.amount}>
        <Input
          id={`amt-${submissionId}`}
          name="amount"
          inputMode="decimal"
          defaultValue={centsToInput(amountCents)}
          className="h-11"
        />
      </FormField>
      <FormField
        id={`proof-${submissionId}`}
        label="Proof screenshot"
        hint="Screenshot of the Juice transfer."
        error={uploadError ?? errors.proof}
      >
        <Input
          id={`proof-${submissionId}`}
          type="file"
          accept={TYPES.join(",")}
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            if (f && (!TYPES.includes(f.type) || f.size > MAX)) {
              setUploadError("JPG, PNG, WebP or PDF up to 10 MB.");
              setFile(null);
            } else {
              setUploadError(null);
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
      {state.message && state.message !== "ok" && (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" size="sm" disabled={pending || uploading}>
        {uploading ? "Uploading…" : pending ? "Reporting…" : "I paid — report it"}
      </Button>
    </form>
  );
}
