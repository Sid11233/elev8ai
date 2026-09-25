import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { CompleteToggle } from "@/components/learn/complete-toggle";
import { Markdown } from "@/components/markdown";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { signBunnyEmbedUrl } from "@/lib/bunny";
import { getOwnedCourseLessons, getPublishedCourse } from "@/lib/courses";

export const metadata: Metadata = { title: "Lesson · Elev8ai" };

export default async function LessonPage({ params }: PageProps<"/app/learn/[slug]/[lessonId]">) {
  const { slug, lessonId } = await params;
  const course = await getPublishedCourse(slug);
  if (!course) notFound();
  if (!course.owned) redirect(`/app/learn/${slug}`);

  const lessons = await getOwnedCourseLessons(course.id);
  const index = lessons.findIndex((l) => l.id === lessonId);
  if (index === -1) notFound();

  const lesson = lessons[index];
  const prev = lessons[index - 1];
  const next = lessons[index + 1];
  const coursePath = `/app/learn/${slug}`;
  const embedUrl = lesson.video_id ? signBunnyEmbedUrl(lesson.video_id) : null;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link
        href={coursePath}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> {course.title}
      </Link>

      <div>
        <p className="text-xs text-muted-foreground">
          Lesson {index + 1} of {lessons.length}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{lesson.title}</h1>
      </div>

      {lesson.video_id &&
        (embedUrl ? (
          <div className="overflow-hidden rounded-xl border bg-black">
            <div className="relative aspect-video">
              <iframe
                src={embedUrl}
                title={lesson.title}
                loading="lazy"
                allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
                className="absolute inset-0 size-full"
              />
            </div>
          </div>
        ) : (
          <Card>
            <CardContent className="py-6 text-center text-sm text-muted-foreground">
              Video isn&apos;t available right now.
            </CardContent>
          </Card>
        ))}

      {lesson.body_md && (
        <Card>
          <CardContent>
            <Markdown>{lesson.body_md}</Markdown>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between gap-2">
        <CompleteToggle lessonId={lesson.id} completed={lesson.completed} coursePath={coursePath} />
        <div className="flex gap-2">
          <Button
            asChild
            variant="outline"
            size="icon"
            disabled={!prev}
            aria-label="Previous lesson"
          >
            {prev ? (
              <Link href={`${coursePath}/${prev.id}`}>
                <ChevronLeft className="size-4" />
              </Link>
            ) : (
              <span>
                <ChevronLeft className="size-4" />
              </span>
            )}
          </Button>
          {next ? (
            <Button asChild className="h-9">
              <Link href={`${coursePath}/${next.id}`}>
                Next <ChevronRight className="size-4" />
              </Link>
            </Button>
          ) : (
            <Button asChild variant="outline" className="h-9">
              <Link href={coursePath}>Finish</Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
