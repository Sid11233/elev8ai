import "server-only";

import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

export type PaymentSettings = Database["public"]["Tables"]["payment_settings"]["Row"];

export async function getPaymentSettings(): Promise<PaymentSettings | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("payment_settings").select("*").eq("id", true).maybeSingle();
  return data;
}
