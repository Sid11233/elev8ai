import { ArrowLeft, FileDown } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ProductPurchasePanel } from "@/components/products/product-purchase-panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { formatCents } from "@/lib/money";
import { getLatestProductPurchase, getPublishedProduct } from "@/lib/products";
import { getPaymentSettings } from "@/lib/payment-settings";

export const metadata: Metadata = { title: "Download · Elev8ai" };

export default async function ProductDetailPage({ params }: PageProps<"/app/products/[slug]">) {
  const { slug } = await params;
  const [product, user] = await Promise.all([getPublishedProduct(slug), getCurrentUser()]);
  if (!product || !user) notFound();

  const [settings, latest] = await Promise.all([
    product.owned ? Promise.resolve(null) : getPaymentSettings(),
    product.owned ? Promise.resolve(null) : getLatestProductPurchase(product.id),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link
        href="/app/products"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> All downloads
      </Link>

      <Card>
        <CardContent className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-xl leading-snug font-semibold">{product.title}</h1>
            {!product.owned && (
              <span className="shrink-0 text-lg font-semibold text-primary">
                {product.price_cents === 0 ? "Free" : formatCents(product.price_cents)}
              </span>
            )}
          </div>
          {product.summary && <p className="text-sm text-muted-foreground">{product.summary}</p>}

          {product.owned && (
            <Button asChild className="h-11">
              <a href={`/app/products/${product.slug}/download`}>
                <FileDown className="size-4" /> Download
                {product.file_name ? ` ${product.file_name}` : ""}
              </a>
            </Button>
          )}
        </CardContent>
      </Card>

      {product.description && (
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed whitespace-pre-line">{product.description}</p>
          </CardContent>
        </Card>
      )}

      {!product.owned && (
        <Card>
          <CardHeader>
            <CardTitle>Get this download</CardTitle>
          </CardHeader>
          <CardContent>
            <ProductPurchasePanel
              productId={product.id}
              slug={product.slug}
              userId={user.id}
              priceCents={product.price_cents}
              instructionsMd={settings?.instructions_md ?? null}
              accountDetails={settings?.account_details ?? null}
              qrUrl={settings?.qr_url ?? null}
              latest={latest}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
