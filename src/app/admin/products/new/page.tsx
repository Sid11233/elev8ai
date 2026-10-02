import type { Metadata } from "next";

import { PageHeader } from "@/components/page-header";

import { ProductForm } from "../product-form";

export const metadata: Metadata = { title: "New product · Admin · lockedinnn" };

export default function NewProductPage() {
  return (
    <>
      <PageHeader title="New product" description="Upload a file, set a price, then publish." />
      <ProductForm />
    </>
  );
}
