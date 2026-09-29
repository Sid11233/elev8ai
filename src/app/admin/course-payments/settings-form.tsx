"use client";

import { type FormEvent, startTransition, useActionState, useState } from "react";

import { FormField } from "@/components/form-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import type { FormState } from "@/lib/validation/form-state";

import { savePaymentSettings } from "./actions";

const IMG = ["image/jpeg", "image/png", "image/webp"];

// Admin edits the payment instructions buyers see, and can upload a QR image.
export function SettingsForm({
  instructions,
  accountDetails,
  qrUrl,
}: {
  instructions: string;
  accountDetails: string;
  qrUrl: string | null;
}) {
  const [state, formAction, pending] = useActionState<FormState<"instructions_md">, FormData>(
    savePaymentSettings,
    {},
  );
  const [qr, setQr] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saved = state.message === "ok";

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError(null);
    if (qr) {
      setUploading(true);
      const supabase = createClient();
      const path = `qr-${Date.now()}.${qr.type.split("/")[1]}`;
      const { error: upErr } = await supabase.storage
        .from("payment-assets")
        .upload(path, qr, { contentType: qr.type, upsert: true });
      if (upErr) {
        setUploading(false);
        setError("Couldn't upload the QR image.");
        return;
      }
      const url = supabase.storage.from("payment-assets").getPublicUrl(path).data.publicUrl;
      setUploading(false);
      formData.set("qr_url", url);
    }
    startTransition(() => formAction(formData));
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <FormField
        id="account_details"
        label="Account details buyers see"
        hint="e.g. MCB Juice number and account name."
        error={undefined}
      >
        <Input
          id="account_details"
          name="account_details"
          defaultValue={accountDetails}
          className="h-11"
        />
      </FormField>
      <FormField
        id="instructions_md"
        label="Payment instructions (markdown)"
        error={state.fieldErrors?.instructions_md}
      >
        <Textarea
          id="instructions_md"
          name="instructions_md"
          rows={3}
          defaultValue={instructions}
        />
      </FormField>
      <FormField id="qr" label="Payment QR image (optional)" error={error ?? undefined}>
        <div className="flex items-center gap-3">
          {qrUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrUrl} alt="Current QR" className="size-16 rounded border" />
          )}
          <Input
            id="qr"
            type="file"
            accept={IMG.join(",")}
            onChange={(e) => setQr(e.target.files?.[0] ?? null)}
          />
        </div>
      </FormField>
      {saved && (
        <Alert>
          <AlertDescription className="text-primary">Payment settings saved.</AlertDescription>
        </Alert>
      )}
      {state.message && !saved && (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" className="h-10 px-6" disabled={pending || uploading}>
        {uploading ? "Uploading…" : pending ? "Saving…" : "Save payment settings"}
      </Button>
    </form>
  );
}
