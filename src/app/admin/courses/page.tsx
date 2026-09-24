import { GraduationCap } from "lucide-react";
import type { Metadata } from "next";

import { ComingSoon } from "@/components/coming-soon";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Courses · Admin · Elev8ai" };

export default function AdminCoursesPage() {
  return (
    <>
      <PageHeader title="Courses" description="Courses, lessons and pricing." />
      <ComingSoon icon={GraduationCap} text="Course and lesson editing arrives in Phase 5." />
    </>
  );
}
