import { Loader2 } from "lucide-react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { PurchasePoller } from "@/components/learn/purchase-poller";
import { Card, CardContent } from "@/components/ui/card";
import { getOwnedCourseLessons, getPublishedCourse } from "@/lib/courses";

export const metadata: Metadata = { title: "Thank you · Elev8ai" };

export default async function PurchasedPage({ params }: PageProps<"/app/learn/[slug]/purchased">) {
  const { slug } = await params;
  const course = await getPublishedCourse(slug);
  if (!course) notFound();

  if (course.owned) {
    const lessons = await getOwnedCourseLessons(course.id);
    redirect(lessons[0] ? `/app/learn/${slug}/${lessons[0].id}` : `/app/learn/${slug}`);
  }

  return (
    <div className="mx-auto flex max-w-md flex-1 items-center justify-center">
      <Card className="w-full">
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="font-medium">Confirming your purchase…</p>
          <p className="text-sm text-muted-foreground">
            This takes a few seconds. We&apos;ll open your course automatically.
          </p>
          <PurchasePoller />
        </CardContent>
      </Card>
    </div>
  );
}
