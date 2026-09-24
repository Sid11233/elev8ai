import { GraduationCap } from "lucide-react";
import type { Metadata } from "next";

import { ComingSoon } from "@/components/coming-soon";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Learn · Elev8ai" };

export default function LearnPage() {
  return (
    <>
      <PageHeader title="Learn" description="Courses that unlock better-paying jobs." />
      <ComingSoon
        icon={GraduationCap}
        text="Courses like Clipping 101 will be listed here. Pass a course to earn a badge and unlock gated jobs."
      />
    </>
  );
}
