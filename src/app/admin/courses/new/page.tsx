import type { Metadata } from "next";

import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";

import { CourseForm } from "../course-form";

export const metadata: Metadata = { title: "New course · Admin · Elev8ai" };

export default async function NewCoursePage() {
  const supabase = await createClient();
  const { data: skills } = await supabase.from("skills").select("id, name").order("name");
  return (
    <>
      <PageHeader title="New course" description="Create a draft, add lessons, then publish." />
      <CourseForm skills={skills ?? []} />
    </>
  );
}
