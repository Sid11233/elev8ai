import "server-only";

import { getCurrentUser } from "@/lib/auth";
import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

export type Course = Database["public"]["Tables"]["courses"]["Row"];
export type Lesson = Database["public"]["Tables"]["lessons"]["Row"];

// Admin: every course with lesson count.
export async function getAllCourses() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("courses")
    .select("*, skill:skills(name), lessons(count)")
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function getCourseById(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("courses")
    .select("*, lessons(*)")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  return { ...data, lessons: [...data.lessons].sort((a, b) => a.position - b.position) };
}

// Talent catalog: published courses, each with the jobs its badge unlocks and
// whether the current user owns it.
export async function getPublishedCourses() {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const [{ data: courses }, { data: access }] = await Promise.all([
    supabase
      .from("courses")
      .select("*, skill:skills(id, name)")
      .eq("published", true)
      .order("price_cents"),
    supabase
      .from("course_access")
      .select("course_id")
      .eq("user_id", user?.id ?? ""),
  ]);

  const owned = new Set((access ?? []).map((a) => a.course_id));
  const skillIds = (courses ?? []).map((c) => c.skill_id).filter((s): s is string => !!s);
  const unlocks = new Map<string, number>();
  if (skillIds.length) {
    const { data: jobs } = await supabase
      .from("jobs")
      .select("required_skill_id")
      .eq("status", "open")
      .in("required_skill_id", skillIds);
    for (const j of jobs ?? []) {
      if (j.required_skill_id)
        unlocks.set(j.required_skill_id, (unlocks.get(j.required_skill_id) ?? 0) + 1);
    }
  }

  return (courses ?? []).map((c) => ({
    ...c,
    owned: owned.has(c.id),
    unlockedJobs: c.skill_id ? (unlocks.get(c.skill_id) ?? 0) : 0,
  }));
}

// Talent course page by slug: course + owned flag. Syllabus/lessons fetched
// separately depending on ownership.
export async function getPublishedCourse(slug: string) {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data: course } = await supabase
    .from("courses")
    .select("*, skill:skills(id, name)")
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle();
  if (!course) return null;

  const [{ data: access }, { data: syllabus }] = await Promise.all([
    supabase
      .from("course_access")
      .select("id")
      .eq("user_id", user?.id ?? "")
      .eq("course_id", course.id)
      .maybeSingle(),
    supabase.rpc("get_course_syllabus", { p_course_id: course.id }),
  ]);

  return { ...course, owned: !!access, syllabus: syllabus ?? [] };
}

// Owner's lessons for a course (full rows) plus their completions.
export async function getOwnedCourseLessons(courseId: string) {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const [{ data: lessons }, { data: completions }] = await Promise.all([
    supabase.from("lessons").select("*").eq("course_id", courseId).order("position"),
    supabase
      .from("lesson_completions")
      .select("lesson_id")
      .eq("user_id", user?.id ?? ""),
  ]);
  const done = new Set((completions ?? []).map((c) => c.lesson_id));
  return (lessons ?? []).map((l) => ({ ...l, completed: done.has(l.id) }));
}
