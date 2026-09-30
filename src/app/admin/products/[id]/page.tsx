import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { getProductById } from "@/lib/products";

import { deleteProduct } from "../actions";
import { ProductForm } from "../product-form";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Edit product · Admin · Elev8ai" };

export default async function EditProductPage({ params }: PageProps<"/admin/products/[id]">) {
  const { id } = await params;
  const product = await getProductById(id);
  if (!product) notFound();

  return (
    <>
      <PageHeader
        title={product.title}
        description="Edit the product details or replace its file."
      />
      <div className="space-y-8">
        <ProductForm product={product} />
        <form action={deleteProduct.bind(null, product.id)}>
          <Button type="submit" variant="outline" className="h-10 text-destructive">
            Delete product
          </Button>
        </form>
      </div>
    </>
  );
}
