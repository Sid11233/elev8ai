import { Banknote } from "lucide-react";
import type { Metadata } from "next";

import { ComingSoon } from "@/components/coming-soon";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Payouts · Admin · Elev8ai" };

export default function AdminPayoutsPage() {
  return (
    <>
      <PageHeader title="Payouts" description="Money owed to talent, and transfers you've sent." />
      <ComingSoon
        icon={Banknote}
        text="The payout ledger, mark-as-paid and CSV export arrive in Phase 3."
      />
    </>
  );
}
