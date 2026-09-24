import { ClipboardList } from "lucide-react";
import type { Metadata } from "next";

import { ComingSoon } from "@/components/coming-soon";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "My Jobs · Elev8ai" };

export default function MyJobsPage() {
  return (
    <>
      <PageHeader
        title="My Jobs"
        description="Jobs you've applied to, are working on, or have finished."
      />
      <ComingSoon
        icon={ClipboardList}
        text="Your applications and jobs in progress will show here, grouped into Applied, In progress, Submitted and Completed."
      />
    </>
  );
}
