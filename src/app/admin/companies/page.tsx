import { Building2 } from "lucide-react";
import type { Metadata } from "next";

import { ComingSoon } from "@/components/coming-soon";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Companies · Admin · Elev8ai" };

export default function AdminCompaniesPage() {
  return (
    <>
      <PageHeader
        title="Companies"
        description="The companies that post jobs: your agency, podcast, clothing brand and the web dev agency."
      />
      <ComingSoon
        icon={Building2}
        text="Create and edit companies and their logos here (Phase 2)."
      />
    </>
  );
}
