"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth";
import { notifyBadgeAwarded } from "@/lib/notify-events";
import { createClient } from "@/lib/supabase/server";

const idSchema = z.object({ userId: z.uuid(), skillId: z.uuid() });

export async function awardBadge(formData: FormData) {
  const admin = await requireAdmin();
  const parsed = idSchema.safeParse({
    userId: formData.get("userId"),
    skillId: formData.get("skillId"),
  });
  if (!parsed.success) return;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_skills")
    .upsert(
      {
        user_id: parsed.data.userId,
        skill_id: parsed.data.skillId,
        source: "manual",
        awarded_by: admin.user_id,
      },
      { onConflict: "user_id,skill_id", ignoreDuplicates: true },
    )
    .select("id");
  if (!error && data && data.length > 0) {
    await notifyBadgeAwarded(parsed.data.userId, parsed.data.skillId);
  }
  revalidatePath("/admin/users");
}

export async function revokeBadge(formData: FormData) {
  await requireAdmin();
  const parsed = idSchema.safeParse({
    userId: formData.get("userId"),
    skillId: formData.get("skillId"),
  });
  if (!parsed.success) return;

  const supabase = await createClient();
  await supabase
    .from("user_skills")
    .delete()
    .eq("user_id", parsed.data.userId)
    .eq("skill_id", parsed.data.skillId);
  revalidatePath("/admin/users");
}
