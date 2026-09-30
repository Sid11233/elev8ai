import { FileDown, Package } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { requireOnboardedProfile } from "@/lib/auth";
import { formatCents } from "@/lib/money";
import { getPublishedProducts } from "@/lib/products";

export const metadata: Metadata = { title: "Downloads · Elev8ai" };

export default async function ProductsPage() {
  await requireOnboardedProfile();
  const products = await getPublishedProducts();

  return (
    <>
      <PageHeader
        title="Downloads"
        description="Guides, templates and resources to help you earn."
      />

      {products.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {products.map((product) => (
            <Card key={product.id} className="relative transition-colors hover:border-primary/40">
              <CardContent className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-semibold">
                    <Link
                      href={`/app/products/${product.slug}`}
                      className="after:absolute after:inset-0"
                    >
                      {product.title}
                    </Link>
                  </h2>
                  {product.owned ? (
                    <Badge className="border-0 bg-primary/15 text-primary">Owned</Badge>
                  ) : (
                    <span className="shrink-0 font-semibold text-primary">
                      {product.price_cents === 0 ? "Free" : formatCents(product.price_cents)}
                    </span>
                  )}
                </div>
                {product.summary && (
                  <p className="line-clamp-2 text-sm text-muted-foreground">{product.summary}</p>
                )}
                {product.owned && (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <FileDown className="size-3.5" /> Ready to download
                  </span>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Package className="size-6" />
            </span>
            <p className="max-w-sm text-sm text-muted-foreground">
              Downloadable guides and templates are coming soon.
            </p>
          </CardContent>
        </Card>
      )}
    </>
  );
}
