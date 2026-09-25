import { ArrowLeft, CheckCircle2, Circle, PlayCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AssignmentSection } from "@/components/learn/assignment-section";
import { BuyButton } from "@/components/learn/buy-button";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { getCourseAssignmentState, getOwnedCourseLessons, getPublishedCourse } from "@/lib/courses";
import { formatCents } from "@/lib/money";

export const metadata: Metadata = { title: "Course · Elev8ai" };

export default async function CoursePage({ params }: PageProps<"/app/learn/[slug]">) {
  const { slug } = await params;
  const course = await getPublishedCourse(slug);
  if (!course) notFound();

  const lessons = course.owned ? await getOwnedCourseLessons(course.id) : [];
  const completedCount = lessons.filter((l) => l.completed).length;
  const nextLesson = lessons.find((l) => !l.completed) ?? lessons[0];
  const progress = lessons.length ? Math.round((completedCount / lessons.length) * 100) : 0;

  const [user, assignment] = course.assignment_brief
    ? await Promise.all([getCurrentUser(), getCourseAssignmentState(course.id, course.owned)])
    : [null, null];

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/app/learn"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> All courses
      </Link>

      <PageHeader title={course.title} description={course.description ?? undefined} />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        {course.skill && <Badge variant="secondary">Awards the {course.skill.name} badge</Badge>}
        {!course.owned && (
          <span className="font-semibold text-primary">
            {course.price_cents === 0 ? "Free" : formatCents(course.price_cents)}
          </span>
        )}
      </div>

      {course.owned ? (
        <Card className="mb-5">
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Your progress</span>
              <span className="text-muted-foreground">
                {completedCount}/{lessons.length} lessons
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-secondary">
              <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
            </div>
            {nextLesson && (
              <Button asChild className="h-11 w-full sm:w-auto">
                <Link href={`/app/learn/${course.slug}/${nextLesson.id}`}>
                  <PlayCircle className="size-4" />
                  {completedCount === 0
                    ? "Start course"
                    : completedCount === lessons.length
                      ? "Review lessons"
                      : "Continue"}
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="mb-5">
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Buy once to unlock every lesson
              {course.skill ? ` and earn the ${course.skill.name} badge` : ""}.
            </p>
            <BuyButton courseId={course.id} priceCents={course.price_cents} />
          </CardContent>
        </Card>
      )}

      <h2 className="mb-3 font-semibold">Lessons</h2>
      <Card>
        <CardContent className="p-0">
          <ul className="divide-y">
            {course.owned
              ? lessons.map((lesson) => (
                  <li key={lesson.id}>
                    <Link
                      href={`/app/learn/${course.slug}/${lesson.id}`}
                      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent"
                    >
                      {lesson.completed ? (
                        <CheckCircle2 className="size-5 shrink-0 text-primary" />
                      ) : (
                        <Circle className="size-5 shrink-0 text-muted-foreground" />
                      )}
                      <span className="text-sm">{lesson.title}</span>
                    </Link>
                  </li>
                ))
              : course.syllabus.map((lesson) => (
                  <li key={lesson.id} className="flex items-center gap-3 px-4 py-3">
                    <Circle className="size-5 shrink-0 text-muted-foreground" />
                    <span className="text-sm">{lesson.title}</span>
                  </li>
                ))}
            {(course.owned ? lessons : course.syllabus).length === 0 && (
              <li className="px-4 py-6 text-center text-sm text-muted-foreground">
                Lessons are being added.
              </li>
            )}
          </ul>
        </CardContent>
      </Card>

      {course.owned && course.assignment_brief && user && assignment && (
        <div className="mt-4">
          <AssignmentSection
            courseId={course.id}
            slug={course.slug}
            userId={user.id}
            brief={course.assignment_brief}
            latest={assignment.latest}
            canSubmit={assignment.canSubmit}
          />
        </div>
      )}
    </div>
  );
}
