"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  type CourseField,
  courseSchema,
  type LessonField,
  lessonSchema,
} from "@/lib/validation/course";
import { type FormState, fieldErrorsOf, textValues } from "@/lib/validation/form-state";

const COURSE_FIELDS = [
  "title",
  "slug",
  "description",
  "price",
  "skill_id",
  "lemon_variant_id",
  "intent",
] as const;

export async function saveCourse(
  courseId: string | null,
  _prev: FormState<CourseField>,
  formData: FormData,
): Promise<FormState<CourseField>> {
  await requireAdmin();
  const values = textValues(formData, COURSE_FIELDS);
  const parsed = courseSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), values };

  const { intent, price, ...rest } = parsed.data;
  const published = intent === "publish" ? true : intent === "draft" ? false : undefined;
  const row = { ...rest, price_cents: price, ...(published !== undefined ? { published } : {}) };

  const supabase = await createClient();
  const saved = courseId
    ? await supabase.from("courses").update(row).eq("id", courseId).select("id").single()
    : await supabase.from("courses").insert(row).select("id").single();

  if (saved.error) {
    if (saved.error.code === "23505")
      return { fieldErrors: { slug: "That slug is taken" }, values };
    return { message: "Couldn't save the course. Please try again.", values };
  }

  if (!courseId) redirect(`/admin/courses/${saved.data.id}`);
  revalidatePath(`/admin/courses/${courseId}`);
  revalidatePath("/admin/courses");
  return {};
}

const LESSON_FIELDS = ["title", "position", "body_md", "video_id"] as const;

export async function saveLesson(
  courseId: string,
  lessonId: string | null,
  _prev: FormState<LessonField>,
  formData: FormData,
): Promise<FormState<LessonField>> {
  await requireAdmin();
  const values = textValues(formData, LESSON_FIELDS);
  const parsed = lessonSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), values };

  const supabase = await createClient();
  const { error } = lessonId
    ? await supabase.from("lessons").update(parsed.data).eq("id", lessonId)
    : await supabase.from("lessons").insert({ ...parsed.data, course_id: courseId });
  if (error) return { message: "Couldn't save the lesson. Please try again.", values };

  revalidatePath(`/admin/courses/${courseId}`);
  return {};
}

export async function deleteLesson(courseId: string, lessonId: string) {
  await requireAdmin();
  const supabase = await createClient();
  await supabase.from("lessons").delete().eq("id", lessonId);
  revalidatePath(`/admin/courses/${courseId}`);
}
