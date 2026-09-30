"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { type FormState, fieldErrorsOf, textValues } from "@/lib/validation/form-state";
import { type ProductField, productSchema } from "@/lib/validation/product";

const PRODUCT_FIELDS = [
  "title",
  "slug",
  "summary",
  "description",
  "price",
  "file_path",
  "file_name",
  "intent",
] as const;

export async function saveProduct(
  productId: string | null,
  _prev: FormState<ProductField>,
  formData: FormData,
): Promise<FormState<ProductField>> {
  await requireAdmin();
  const values = textValues(formData, PRODUCT_FIELDS);
  const parsed = productSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), values };

  const { intent, price, file_path, file_name, ...rest } = parsed.data;
  const published = intent === "publish" ? true : intent === "draft" ? false : undefined;

  // A product can't be published without a file to download.
  if (published && !file_path && !productId) {
    return { fieldErrors: { file: "Upload the downloadable file before publishing" }, values };
  }

  const row = {
    ...rest,
    price_cents: price,
    // Only overwrite the file when a new one was uploaded.
    ...(file_path ? { file_path, file_name } : {}),
    ...(published !== undefined ? { published } : {}),
  };

  const supabase = await createClient();

  if (published) {
    // Guard publishing an existing product that still has no file.
    const existingPath =
      file_path ??
      (productId
        ? (await supabase.from("products").select("file_path").eq("id", productId).single()).data
            ?.file_path
        : null);
    if (!existingPath) {
      return { fieldErrors: { file: "Upload the downloadable file before publishing" }, values };
    }
  }

  const saved = productId
    ? await supabase.from("products").update(row).eq("id", productId).select("id").single()
    : await supabase.from("products").insert(row).select("id").single();

  if (saved.error) {
    if (saved.error.code === "23505")
      return { fieldErrors: { slug: "That slug is taken" }, values };
    return { message: "Couldn't save the product. Please try again.", values };
  }

  if (!productId) redirect(`/admin/products/${saved.data.id}`);
  revalidatePath(`/admin/products/${productId}`);
  revalidatePath("/admin/products");
  revalidatePath("/app/products");
  return {};
}

export async function deleteProduct(productId: string) {
  await requireAdmin();
  const supabase = await createClient();
  await supabase.from("products").delete().eq("id", productId);
  revalidatePath("/admin/products");
  redirect("/admin/products");
}
