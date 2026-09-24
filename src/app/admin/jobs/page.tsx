import { Briefcase } from "lucide-react";
import type { Metadata } from "next";

import { ComingSoon } from "@/components/coming-soon";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Jobs · Admin · Elev8ai" };

export default function AdminJobsPage() {
  return (
    <>
      <PageHeader title="Jobs" description="Post, publish, close and duplicate jobs." />
      <ComingSoon
        icon={Briefcase}
        text="Job posting with pay, slots, deadlines and required badges arrives in Phase 2."
      />
    </>
  );
}
