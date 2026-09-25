import type { NextRequest } from "next/server";

import { track } from "@/lib/analytics";
import { notify } from "@/lib/notify";
import { verifyWebhookSignature } from "@/lib/lemonsqueezy";
import { createAdminClient } from "@/lib/supabase/admin";

// Lemon Squeezy webhook: grants course access on purchase, removes it on refund.
// Signature-verified and idempotent on the order id.
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-signature");
  if (!verifyWebhookSignature(rawBody, signature)) {
    return new Response("Invalid signature", { status: 401 });
  }

  let event: {
    meta?: { event_name?: string; custom_data?: { user_id?: string; course_id?: string } };
    data?: { id?: string; attributes?: Record<string, unknown> };
  };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response("Bad payload", { status: 400 });
  }

  const eventName = event.meta?.event_name;
  const custom = event.meta?.custom_data;
  const orderId = event.data?.id;
  const supabase = createAdminClient();

  if (eventName === "order_created") {
    const userId = custom?.user_id;
    const courseId = custom?.course_id;
    if (!userId || !courseId) return new Response("Missing custom data", { status: 400 });

    // Idempotent: unique(user_id, course_id) means a replayed order can't grant twice.
    const total = event.data?.attributes?.total as number | undefined;
    const { data: inserted } = await supabase
      .from("course_access")
      .upsert(
        { user_id: userId, course_id: courseId, order_id: orderId, amount_cents: total ?? null },
        { onConflict: "user_id,course_id", ignoreDuplicates: true },
      )
      .select("id");

    // Only notify on a genuinely new grant.
    if (inserted && inserted.length > 0) {
      track("course_purchased", userId, { course_id: courseId, amount_cents: total ?? null });
      const { data: course } = await supabase
        .from("courses")
        .select("title, slug")
        .eq("id", courseId)
        .single();
      await notify({
        userId,
        type: "course_purchased",
        title: "Course unlocked 🎉",
        body: course
          ? `You now have access to ${course.title}. Start learning!`
          : "Your course is ready.",
        link: course ? `/app/learn/${course.slug}` : "/app/learn",
      });
    }
    return Response.json({ ok: true });
  }

  if (eventName === "order_refunded") {
    if (orderId) await supabase.from("course_access").delete().eq("order_id", orderId);
    return Response.json({ ok: true });
  }

  // Ignore other events.
  return Response.json({ ok: true });
}
