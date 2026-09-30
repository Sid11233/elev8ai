import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Download a product file. Access is checked with the caller's session
// (has_product_access), then the file is signed with the service role since the
// product-files bucket is private and admin-only at the RLS layer.
export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const productPath = new URL(`/app/products/${slug}`, req.url);
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));

  const supabase = await createClient();
  const { data: product } = await supabase
    .from("products")
    .select("id, file_path, file_name")
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle();
  if (!product?.file_path) return NextResponse.redirect(productPath);

  const { data: hasAccess } = await supabase.rpc("has_product_access", {
    p_product_id: product.id,
  });
  if (!hasAccess) return NextResponse.redirect(productPath);

  const admin = createAdminClient();
  const { data: signed } = await admin.storage
    .from("product-files")
    .createSignedUrl(product.file_path, 60, { download: product.file_name ?? true });
  if (!signed?.signedUrl) return NextResponse.redirect(productPath);

  return NextResponse.redirect(signed.signedUrl);
}
