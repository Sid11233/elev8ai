import "server-only";

import { getCurrentUser } from "@/lib/auth";
import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

export type Product = Database["public"]["Tables"]["products"]["Row"];
export type ProductPurchase = Database["public"]["Tables"]["product_purchases"]["Row"];

// Admin: every product, newest first.
export async function getAllProducts() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function getProductById(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("products").select("*").eq("id", id).maybeSingle();
  return data;
}

// Talent catalog: published products with an owned flag.
export async function getPublishedProducts() {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const [{ data: products }, { data: access }] = await Promise.all([
    supabase.from("products").select("*").eq("published", true).order("price_cents"),
    supabase
      .from("product_access")
      .select("product_id")
      .eq("user_id", user?.id ?? ""),
  ]);
  const owned = new Set((access ?? []).map((a) => a.product_id));
  return (products ?? []).map((p) => ({ ...p, owned: owned.has(p.id) }));
}

// One published product by slug, with owned flag.
export async function getPublishedProduct(slug: string) {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data: product } = await supabase
    .from("products")
    .select("*")
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle();
  if (!product) return null;
  const { data: access } = await supabase
    .from("product_access")
    .select("id")
    .eq("product_id", product.id)
    .eq("user_id", user?.id ?? "")
    .maybeSingle();
  return { ...product, owned: !!access };
}

// The current user's latest purchase request for a product.
export async function getLatestProductPurchase(productId: string) {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from("product_purchases")
    .select("*")
    .eq("product_id", productId)
    .eq("user_id", user?.id ?? "")
    .order("created_at", { ascending: false })
    .limit(1);
  return data?.[0] ?? null;
}
