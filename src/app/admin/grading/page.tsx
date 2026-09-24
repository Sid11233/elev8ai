import { Star } from "lucide-react";
import type { Metadata } from "next";

import { ComingSoon } from "@/components/coming-soon";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Grading · Admin · Elev8ai" };

export default function AdminGradingPage() {
  return (
    <>
      <PageHeader title="Grading" description="Grade course assignments to award badges." />
      <ComingSoon icon={Star} text="The grading queue arrives in Phase 6." />
    </>
  );
}
