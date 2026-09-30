"use client";

import { FileText, Paperclip } from "lucide-react";
import Link from "next/link";
import { type FormEvent, startTransition, useActionState, useState } from "react";

import { FormField } from "@/components/form-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { centsToInput } from "@/lib/money";
import type { Product } from "@/lib/products";
import { createClient } from "@/lib/supabase/client";
import type { FormState } from "@/lib/validation/form-state";
import type { ProductField } from "@/lib/validation/product";

import { saveProduct } from "./actions";

const MAX = 50 * 1024 * 1024;

export function ProductForm({ product }: { product?: Product }) {
  const [state, formAction, pending] = useActionState<FormState<ProductField>, FormData>(
    saveProduct.bind(null, product?.id ?? null),
    {},
  );
  const errors = state.fieldErrors ?? {};
  const v = (k: ProductField, fallback = "") => state.values?.[k] ?? fallback;
  const published = product?.published ?? false;

  const [file, setFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setUploadError(null);
    if (file) {
      if (file.size > MAX) {
        setUploadError("File must be 50 MB or smaller.");
        return;
      }
      setUploading(true);
      const supabase = createClient();
      const safeName = file.name.replace(/[^a-z0-9.]+/gi, "-").slice(-80);
      const path = `products/${Date.now()}-${safeName}`;
      const { error } = await supabase.storage
        .from("product-files")
        .upload(path, file, { contentType: file.type });
      setUploading(false);
      if (error) {
        setUploadError("Couldn't upload the file. Try again.");
        return;
      }
      formData.set("file_path", path);
      formData.set("file_name", file.name.slice(0, 200));
    }
    startTransition(() => formAction(formData));
  }

  return (
    <form onSubmit={onSubmit} className="max-w-xl space-y-4" noValidate>
      <FormField id="title" label="Title" error={errors.title}>
        <Input
          id="title"
          name="title"
          required
          defaultValue={v("title", product?.title)}
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
          defaultValue={v("slug", product?.slug)}
          className="h-11"
        />
      </FormField>

      <FormField
        id="summary"
        label="Short summary"
        hint="Shown on the catalog card."
        error={errors.summary}
      >
        <Input
          id="summary"
          name="summary"
          defaultValue={v("summary", product?.summary ?? "")}
          className="h-11"
        />
      </FormField>

      <FormField id="description" label="Description" error={errors.description}>
        <Textarea
          id="description"
          name="description"
          rows={4}
          defaultValue={v("description", product?.description ?? "")}
        />
      </FormField>

      <FormField id="price" label="Price (USD)" hint="Use 0 for free." error={errors.price}>
        <Input
          id="price"
          name="price"
          inputMode="decimal"
          placeholder="12.00"
          defaultValue={v("price", product ? centsToInput(product.price_cents) : "")}
          className="h-11"
        />
      </FormField>

      <FormField
        id="file"
        label="Downloadable file"
        hint="PDF, ZIP, Office docs or images, up to 50 MB. Buyers download this after payment is verified."
        error={uploadError ?? errors.file}
      >
        <Input
          id="file"
          type="file"
          onChange={(e) => {
            setUploadError(null);
            setFile(e.target.files?.[0] ?? null);
          }}
        />
        {file ? (
          <p className="flex items-center gap-1.5 pt-1 text-sm">
            <Paperclip className="size-3.5 text-muted-foreground" />
            {file.name}
          </p>
        ) : (
          product?.file_name && (
            <p className="flex items-center gap-1.5 pt-1 text-sm text-muted-foreground">
              <FileText className="size-3.5" />
              Current: {product.file_name} — choose a file only to replace it.
            </p>
          )
        )}
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
              disabled={pending || uploading}
            >
              {uploading ? "Uploading…" : "Save changes"}
            </Button>
            <Button
              type="submit"
              name="intent"
              value="draft"
              variant="outline"
              className="h-11"
              disabled={pending || uploading}
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
              disabled={pending || uploading}
            >
              {product ? "Save draft" : "Create draft"}
            </Button>
            <Button
              type="submit"
              name="intent"
              value="publish"
              className="h-11 px-6"
              disabled={pending || uploading}
            >
              {uploading ? "Uploading…" : "Publish"}
            </Button>
          </>
        )}
        <Button asChild variant="ghost" className="h-11">
          <Link href="/admin/products">Cancel</Link>
        </Button>
      </div>
    </form>
  );
}
