import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

import { PayoutForm } from "./payout-form";

export const metadata: Metadata = { title: "Payout details · Elev8ai" };

export default async function PayoutSettingsPage() {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data: details } = await supabase
    .from("payout_details")
    .select("method, details")
    .eq("user_id", user?.id ?? "")
    .maybeSingle();

  return (
    <div className="mx-auto max-w-md">
      <Link
        href="/app/profile"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Profile
      </Link>
      <PageHeader
        title="Payout details"
        description="Where we send your earnings. Fill this in before your first payout."
      />
      <PayoutForm
        initialMethod={details?.method ?? null}
        initialDetails={(details?.details as Record<string, unknown>) ?? {}}
      />
    </div>
  );
}
