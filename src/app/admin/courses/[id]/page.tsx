import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { getCourseById } from "@/lib/courses";
import { createClient } from "@/lib/supabase/server";

import { CourseForm } from "../course-form";
import { LessonsManager } from "../lessons-manager";

export const metadata: Metadata = { title: "Edit course · Admin · Elev8ai" };

export default async function EditCoursePage({ params }: PageProps<"/admin/courses/[id]">) {
  const { id } = await params;
  const [course, supabase] = await Promise.all([getCourseById(id), createClient()]);
  if (!course) notFound();
  const { data: skills } = await supabase.from("skills").select("id, name").order("name");

  return (
    <>
      <PageHeader title={course.title} description="Edit the course, then manage its lessons." />
      <div className="space-y-8">
        <CourseForm course={course} skills={skills ?? []} />
        <section>
          <h2 className="mb-3 text-lg font-semibold">Lessons</h2>
          <LessonsManager courseId={course.id} lessons={course.lessons} />
        </section>
      </div>
    </>
  );
}
