"use client";

import { Paperclip } from "lucide-react";
import { type FormEvent, startTransition, useActionState, useState } from "react";

import { FormField } from "@/components/form-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { PAYOUT_METHODS } from "@/lib/payout-methods";
import { createClient } from "@/lib/supabase/client";

import { type PayoutFormState, savePayoutDetails } from "./actions";

const QR_TYPES = ["image/jpeg", "image/png", "image/webp"];
const QR_MAX = 5 * 1024 * 1024;

export function PayoutForm({
  userId,
  initialMethod,
  initialDetails,
  initialQrUrl,
}: {
  userId: string;
  initialMethod: string | null;
  initialDetails: Record<string, unknown>;
  initialQrUrl: string | null;
}) {
  const [state, formAction, pending] = useActionState<PayoutFormState, FormData>(
    savePayoutDetails,
    {},
  );
  const [method, setMethod] = useState(initialMethod ?? PAYOUT_METHODS[0].value);
  const config = PAYOUT_METHODS.find((m) => m.value === method) ?? PAYOUT_METHODS[0];
  const [qrFile, setQrFile] = useState<File | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const errors = state.fieldErrors ?? {};
  const saved = state.message === "ok";

  const value = (key: string) =>
    state.values?.[key] ??
    (method === initialMethod ? ((initialDetails[key] as string) ?? "") : "");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setQrError(null);
    if (qrFile) {
      setUploading(true);
      const supabase = createClient();
      const path = `${userId}/qr-${Date.now()}-${qrFile.name.replace(/[^a-z0-9.]+/gi, "-").slice(-40)}`;
      const { error } = await supabase.storage
        .from("juice-qr")
        .upload(path, qrFile, { contentType: qrFile.type, upsert: true });
      setUploading(false);
      if (error) {
        setQrError("Couldn't upload your QR. Try again.");
        return;
      }
      formData.set("juice_qr_url", path);
    }
    startTransition(() => formAction(formData));
  }

  return (
    <form onSubmit={onSubmit} className="max-w-md space-y-4" noValidate>
      <FormField id="method" label="Payout method" error={errors.method}>
        <NativeSelect
          id="method"
          name="method"
          value={method}
          onChange={(e) => setMethod(e.target.value)}
        >
          {PAYOUT_METHODS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </NativeSelect>
      </FormField>

      {config.fields.map((field) => (
        <FormField key={field.key} id={field.key} label={field.label} error={errors[field.key]}>
          <Input
            id={field.key}
            name={field.key}
            defaultValue={value(field.key)}
            placeholder={"placeholder" in field ? field.placeholder : undefined}
            className="h-11"
          />
        </FormField>
      ))}

      <FormField
        id="juice_qr"
        label="Juice QR code"
        hint="Upload your MCB Juice QR. Companies scan this to pay you after they approve your work."
        error={qrError ?? undefined}
      >
        {initialQrUrl && !qrFile && (
          // Current QR from the public juice-qr bucket.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={initialQrUrl}
            alt="Your current Juice QR"
            className="mb-2 size-32 rounded-lg border object-contain"
          />
        )}
        <Input
          id="juice_qr"
          type="file"
          accept={QR_TYPES.join(",")}
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            if (f && (!QR_TYPES.includes(f.type) || f.size > QR_MAX)) {
              setQrError("JPG, PNG or WebP up to 5 MB.");
              setQrFile(null);
            } else {
              setQrError(null);
              setQrFile(f);
            }
          }}
        />
        {qrFile && (
          <p className="flex items-center gap-1.5 pt-1 text-sm">
            <Paperclip className="size-3.5 text-muted-foreground" />
            {qrFile.name}
          </p>
        )}
      </FormField>

      {saved && (
        <Alert>
          <AlertDescription className="text-primary">Payout details saved.</AlertDescription>
        </Alert>
      )}
      {state.message && !saved && (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}

      <Button type="submit" className="h-11 px-6" disabled={pending || uploading}>
        {uploading ? "Uploading…" : pending ? "Saving…" : "Save payout details"}
      </Button>
    </form>
  );
}
