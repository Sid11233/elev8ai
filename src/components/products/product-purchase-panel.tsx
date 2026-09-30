"use client";

import { Clock, Paperclip } from "lucide-react";
import { type FormEvent, startTransition, useActionState, useState } from "react";

import {
  type PurchaseField,
  requestProductPurchase,
} from "@/app/app/products/[slug]/purchase-actions";
import { FormField } from "@/components/form-field";
import { Markdown } from "@/components/markdown";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatCents } from "@/lib/money";
import type { ProductPurchase } from "@/lib/products";
import { createClient } from "@/lib/supabase/client";
import type { FormState } from "@/lib/validation/form-state";

const TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX = 10 * 1024 * 1024;

export function ProductPurchasePanel({
  productId,
  slug,
  userId,
  priceCents,
  instructionsMd,
  accountDetails,
  qrUrl,
  latest,
}: {
  productId: string;
  slug: string;
  userId: string;
  priceCents: number;
  instructionsMd: string | null;
  accountDetails: string | null;
  qrUrl: string | null;
  latest: ProductPurchase | null;
}) {
  const [state, formAction, pending] = useActionState<FormState<PurchaseField>, FormData>(
    requestProductPurchase.bind(null, productId, slug),
    {},
  );
  const [file, setFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  if (latest?.status === "pending") {
    return (
      <Alert>
        <AlertDescription className="flex items-center gap-2">
          <Clock className="size-4" /> Payment received — we&apos;re verifying it (usually within 24
          hours). You&apos;ll be able to download as soon as it&apos;s confirmed.
        </AlertDescription>
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
      const path = `${userId}/${productId}/${Date.now()}-${file.name.replace(/[^a-z0-9.]+/gi, "-").slice(-60)}`;
      const { error } = await supabase.storage
        .from("payment-proofs")
        .upload(path, file, { contentType: file.type });
      setUploading(false);
      if (error) {
        setUploadError("Couldn't upload your screenshot. Try again.");
        return;
      }
      formData.set("proof_path", path);
    }
    startTransition(() => formAction(formData));
  }

  return (
    <div className="space-y-4">
      {latest?.status === "rejected" && (
        <Alert variant="destructive">
          <AlertDescription>
            <span className="font-medium">Your last payment couldn&apos;t be verified.</span>
            {latest.reviewer_note && <span className="mt-1 block">{latest.reviewer_note}</span>}
            <span className="mt-1 block">Please pay again and re-upload your proof below.</span>
          </AlertDescription>
        </Alert>
      )}

      <div className="rounded-xl border bg-secondary/40 p-4">
        <p className="font-medium">
          Pay {priceCents === 0 ? "nothing — it's free" : formatCents(priceCents)} to unlock this
          download
        </p>
        {instructionsMd && (
          <div className="mt-2">
            <Markdown>{instructionsMd}</Markdown>
          </div>
        )}
        {accountDetails && (
          <p className="mt-2 rounded-lg bg-background/60 p-3 text-sm font-medium whitespace-pre-line">
            {accountDetails}
          </p>
        )}
        {qrUrl && (
          // Payment QR from the public payment-assets bucket.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qrUrl} alt="Payment QR code" className="mt-3 size-44 rounded-lg border" />
        )}
      </div>

      <form onSubmit={onSubmit} className="space-y-3" noValidate>
        <FormField
          id="proof"
          label="Proof of payment"
          hint="Upload a screenshot of your payment."
          error={uploadError ?? state.fieldErrors?.proof}
        >
          <Input
            id="proof"
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

        <FormField
          id="reference"
          label="Payment reference (optional)"
          error={state.fieldErrors?.reference}
        >
          <Input
            id="reference"
            name="reference"
            placeholder="e.g. Juice transaction id"
            className="h-11"
          />
        </FormField>

        <FormField id="note" label="Note (optional)" error={state.fieldErrors?.note}>
          <Textarea id="note" name="note" rows={2} maxLength={1000} />
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
          {uploading ? "Uploading…" : pending ? "Submitting…" : "I've paid — submit proof"}
        </Button>
      </form>
    </div>
  );
}
