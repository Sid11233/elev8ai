"use client";

import { Pencil, Plus, Trash2, Video } from "lucide-react";
import { useActionState, useState } from "react";

import { FormField } from "@/components/form-field";
import { Markdown } from "@/components/markdown";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Lesson } from "@/lib/courses";
import { submitWithoutReset } from "@/lib/forms";
import type { FormState } from "@/lib/validation/form-state";
import type { LessonField } from "@/lib/validation/course";

import { deleteLesson, saveLesson } from "./actions";

function LessonForm({
  courseId,
  lesson,
  nextPosition,
  onDone,
}: {
  courseId: string;
  lesson?: Lesson;
  nextPosition: number;
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState<FormState<LessonField>, FormData>(
    async (prev, fd) => {
      const result = await saveLesson(courseId, lesson?.id ?? null, prev, fd);
      if (!result.fieldErrors && !result.message) onDone();
      return result;
    },
    {},
  );
  const errors = state.fieldErrors ?? {};
  const [body, setBody] = useState(lesson?.body_md ?? "");
  const [preview, setPreview] = useState(false);

  return (
    <form onSubmit={submitWithoutReset(formAction)} className="space-y-3" noValidate>
      <div className="grid gap-3 sm:grid-cols-[1fr_7rem]">
        <FormField id="l-title" label="Lesson title" error={errors.title}>
          <Input
            id="l-title"
            name="title"
            required
            defaultValue={lesson?.title ?? ""}
            className="h-10"
          />
        </FormField>
        <FormField id="l-position" label="Position" error={errors.position}>
          <Input
            id="l-position"
            name="position"
            inputMode="numeric"
            defaultValue={String(lesson?.position ?? nextPosition)}
            className="h-10"
          />
        </FormField>
      </div>

      <FormField
        id="l-video"
        label="Bunny video id (optional)"
        hint="The video's GUID from your Bunny Stream library."
        error={errors.video_id}
      >
        <Input
          id="l-video"
          name="video_id"
          defaultValue={lesson?.video_id ?? ""}
          className="h-10"
        />
      </FormField>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Lesson body (markdown)</span>
          <button
            type="button"
            onClick={() => setPreview((p) => !p)}
            className="text-xs font-medium text-primary"
          >
            {preview ? "Edit" : "Preview"}
          </button>
        </div>
        {preview ? (
          <div className="min-h-40 rounded-lg border p-3">
            {body.trim() ? (
              <Markdown>{body}</Markdown>
            ) : (
              <p className="text-sm text-muted-foreground">Nothing to preview.</p>
            )}
          </div>
        ) : (
          <Textarea
            name="body_md"
            rows={8}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="font-mono text-xs"
          />
        )}
        {/* Keep the value in the form when previewing. */}
        {preview && <input type="hidden" name="body_md" value={body} />}
        {errors.body_md && <p className="text-sm text-destructive">{errors.body_md}</p>}
      </div>

      {state.message && (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {lesson ? "Save lesson" : "Add lesson"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function LessonsManager({ courseId, lessons }: { courseId: string; lessons: Lesson[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const nextPosition = (lessons.at(-1)?.position ?? 0) + 1;

  return (
    <div className="space-y-3">
      {lessons.map((lesson) => (
        <Card key={lesson.id}>
          <CardContent>
            {editingId === lesson.id ? (
              <LessonForm
                courseId={courseId}
                lesson={lesson}
                nextPosition={nextPosition}
                onDone={() => setEditingId(null)}
              />
            ) : (
              <div className="flex items-center gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold">
                  {lesson.position}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{lesson.title}</p>
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    {lesson.video_id ? (
                      <>
                        <Video className="size-3" /> video set
                      </>
                    ) : (
                      "no video"
                    )}
                  </p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Edit lesson"
                  onClick={() => setEditingId(lesson.id)}
                >
                  <Pencil className="size-4" />
                </Button>
                <form action={deleteLesson.bind(null, courseId, lesson.id)}>
                  <Button size="icon" variant="ghost" aria-label="Delete lesson" type="submit">
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </form>
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {adding ? (
        <Card>
          <CardContent>
            <LessonForm
              courseId={courseId}
              nextPosition={nextPosition}
              onDone={() => setAdding(false)}
            />
          </CardContent>
        </Card>
      ) : (
        <Button variant="outline" onClick={() => setAdding(true)} className="w-full">
          <Plus className="size-4" /> Add lesson
        </Button>
      )}
    </div>
  );
}
