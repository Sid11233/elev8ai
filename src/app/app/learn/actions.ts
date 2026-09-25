"use server";

import { revalidatePath } from "next/cache";

import { requireOnboardedProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Toggle a lesson's completed state. RLS ensures the user owns the course.
export async function setLessonComplete(lessonId: string, completed: boolean, coursePath: string) {
  const profile = await requireOnboardedProfile();
  const supabase = await createClient();

  if (completed) {
    await supabase
      .from("lesson_completions")
      // ON CONFLICT DO NOTHING: only needs INSERT privilege (no UPDATE grant on
      // this table), and completion is a presence flag with nothing to update.
      .upsert(
        { user_id: profile.user_id, lesson_id: lessonId },
        { onConflict: "user_id,lesson_id", ignoreDuplicates: true },
      );
  } else {
    await supabase
      .from("lesson_completions")
      .delete()
      .eq("user_id", profile.user_id)
      .eq("lesson_id", lessonId);
  }
  revalidatePath(coursePath);
}
