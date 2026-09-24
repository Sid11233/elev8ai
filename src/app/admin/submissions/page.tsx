import { FileCheck } from "lucide-react";
import type { Metadata } from "next";

import { ComingSoon } from "@/components/coming-soon";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Submissions · Admin · Elev8ai" };

export default function AdminSubmissionsPage() {
  return (
    <>
      <PageHeader
        title="Submissions"
        description="Review proof of work: approve, request changes or reject."
      />
      <ComingSoon icon={FileCheck} text="The submissions review queue arrives in Phase 3." />
    </>
  );
}
