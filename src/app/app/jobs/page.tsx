import { Briefcase } from "lucide-react";
import type { Metadata } from "next";

import { ComingSoon } from "@/components/coming-soon";
import { PageHeader } from "@/components/page-header";
import { requireOnboardedProfile } from "@/lib/auth";

export const metadata: Metadata = { title: "Jobs · Elev8ai" };

export default async function JobsPage() {
  const profile = await requireOnboardedProfile();

  return (
    <>
      <PageHeader
        title={`Welcome, ${profile.full_name?.split(" ")[0] ?? "there"}`}
        description="Paid jobs from Elev8ai companies."
      />
      <ComingSoon
        icon={Briefcase}
        text="Open jobs will show up here soon: clipping, content, cold calling and web dev."
      />
    </>
  );
}
