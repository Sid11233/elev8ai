import { Package, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatCents } from "@/lib/money";
import { getAllProducts } from "@/lib/products";

export const metadata: Metadata = { title: "Products · Admin · Elev8ai" };

export default async function AdminProductsPage() {
  const products = await getAllProducts();

  return (
    <>
      <PageHeader title="Products" description="Downloadable documents sold via manual payment.">
        <Button asChild className="h-10">
          <Link href="/admin/products/new">
            <Plus className="size-4" /> New product
          </Link>
        </Button>
      </PageHeader>

      {products.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {products.map((product) => (
            <Card key={product.id}>
              <CardContent className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={`/admin/products/${product.id}`}
                    className="font-medium hover:underline"
                  >
                    {product.title}
                  </Link>
                  <Badge
                    className={
                      product.published
                        ? "border-0 bg-primary/15 text-primary"
                        : "border-0 bg-secondary text-muted-foreground"
                    }
                  >
                    {product.published ? "Published" : "Draft"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {formatCents(product.price_cents)}
                  {product.file_name ? ` · ${product.file_name}` : " · no file yet"}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Package className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No products yet. Create your first one.</p>
          </CardContent>
        </Card>
      )}
    </>
  );
}
