import { Inbox } from "lucide-react";
import type { Metadata } from "next";

import { ComingSoon } from "@/components/coming-soon";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Applications · Admin · Elev8ai" };

export default function AdminApplicationsPage() {
  return (
    <>
      <PageHeader title="Applications" description="Accept or reject talent who applied to jobs." />
      <ComingSoon icon={Inbox} text="The applications queue arrives in Phase 3." />
    </>
  );
}
