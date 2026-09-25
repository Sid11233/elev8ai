import { GraduationCap, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getAllCourses } from "@/lib/courses";
import { formatCents } from "@/lib/money";

export const metadata: Metadata = { title: "Courses · Admin · Elev8ai" };

export default async function AdminCoursesPage() {
  const courses = await getAllCourses();

  return (
    <>
      <PageHeader title="Courses" description="Courses, lessons and pricing.">
        <Button asChild className="h-10">
          <Link href="/admin/courses/new">
            <Plus className="size-4" /> New course
          </Link>
        </Button>
      </PageHeader>

      {courses.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {courses.map((course) => (
            <Card key={course.id}>
              <CardContent className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={`/admin/courses/${course.id}`}
                    className="font-medium hover:underline"
                  >
                    {course.title}
                  </Link>
                  <Badge
                    className={
                      course.published
                        ? "border-0 bg-primary/15 text-primary"
                        : "border-0 bg-secondary text-muted-foreground"
                    }
                  >
                    {course.published ? "Published" : "Draft"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {formatCents(course.price_cents)} · {course.lessons[0]?.count ?? 0} lessons
                  {course.skill && <> · awards {course.skill.name}</>}
                </p>
                {!course.lemon_variant_id && (
                  <p className="text-xs text-amber-300">No Lemon Squeezy variant set</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <GraduationCap className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No courses yet. Create your first one.</p>
          </CardContent>
        </Card>
      )}
    </>
  );
}
