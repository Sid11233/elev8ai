import { GraduationCap } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { requireOnboardedProfile } from "@/lib/auth";
import { getPublishedCourses } from "@/lib/courses";
import { formatCents } from "@/lib/money";

export const metadata: Metadata = { title: "Learn · Elev8ai" };

export default async function LearnPage() {
  await requireOnboardedProfile();
  const courses = await getPublishedCourses();

  return (
    <>
      <PageHeader title="Learn" description="Courses that unlock better-paying jobs." />

      {courses.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {courses.map((course) => (
            <Card key={course.id} className="relative transition-colors hover:border-primary/40">
              <CardContent className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-semibold">
                    <Link
                      href={`/app/learn/${course.slug}`}
                      className="after:absolute after:inset-0"
                    >
                      {course.title}
                    </Link>
                  </h2>
                  {course.owned ? (
                    <Badge className="border-0 bg-primary/15 text-primary">Owned</Badge>
                  ) : (
                    <span className="shrink-0 font-semibold text-primary">
                      {course.price_cents === 0 ? "Free" : formatCents(course.price_cents)}
                    </span>
                  )}
                </div>
                {course.description && (
                  <p className="line-clamp-2 text-sm text-muted-foreground">{course.description}</p>
                )}
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {course.skill && <Badge variant="secondary">Awards {course.skill.name}</Badge>}
                  {course.unlockedJobs > 0 && (
                    <span className="inline-flex items-center">
                      Unlocks {course.unlockedJobs} {course.unlockedJobs === 1 ? "job" : "jobs"}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <GraduationCap className="size-6" />
            </span>
            <p className="max-w-sm text-sm text-muted-foreground">
              Courses are coming soon. They&apos;ll let you earn badges that unlock better-paying
              jobs.
            </p>
          </CardContent>
        </Card>
      )}
    </>
  );
}
