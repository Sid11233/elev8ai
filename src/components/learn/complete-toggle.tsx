"use client";

import { Check, Circle } from "lucide-react";
import { useState, useTransition } from "react";

import { setLessonComplete } from "@/app/app/learn/actions";
import { Button } from "@/components/ui/button";

export function CompleteToggle({
  lessonId,
  completed: initialCompleted,
  coursePath,
}: {
  lessonId: string;
  completed: boolean;
  coursePath: string;
}) {
  // Local state so the button flips instantly; the action revalidates the
  // course page (progress bar) in the background.
  const [completed, setCompleted] = useState(initialCompleted);
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant={completed ? "outline" : "default"}
      className="h-11"
      disabled={pending}
      onClick={() => {
        const next = !completed;
        setCompleted(next);
        startTransition(() => setLessonComplete(lessonId, next, coursePath));
      }}
    >
      {completed ? <Check className="size-4" /> : <Circle className="size-4" />}
      {completed ? "Completed" : "Mark complete"}
    </Button>
  );
}
