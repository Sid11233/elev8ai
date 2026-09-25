"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getCurrentUser, requireOnboardedProfile } from "@/lib/auth";
import { createCheckoutUrl } from "@/lib/lemonsqueezy";
import { getRequestOrigin } from "@/lib/request-origin";
import { createClient } from "@/lib/supabase/server";

export type CheckoutState = { error?: string };

// Starts a Lemon Squeezy checkout for a course and redirects the buyer to it.
export async function startCheckout(courseId: string): Promise<CheckoutState> {
  await requireOnboardedProfile();
  const user = await getCurrentUser();
  if (!user?.email) return { error: "We couldn't start checkout. Please try again." };

  const supabase = await createClient();
  const { data: course } = await supabase
    .from("courses")
    .select("id, slug, price_cents, lemon_variant_id, published")
    .eq("id", courseId)
    .maybeSingle();
  if (!course || !course.published) return { error: "This course isn't available." };

  // Already own it? Go straight in.
  const { data: access } = await supabase
    .from("course_access")
    .select("id")
    .eq("user_id", user.id)
    .eq("course_id", courseId)
    .maybeSingle();
  if (access) redirect(`/app/learn/${course.slug}`);

  if (!course.lemon_variant_id) return { error: "Checkout isn't set up for this course yet." };

  const origin = getRequestOrigin(await headers());
  const url = await createCheckoutUrl({
    variantId: course.lemon_variant_id,
    email: user.email,
    userId: user.id,
    courseId: course.id,
    redirectUrl: `${origin}/app/learn/${course.slug}/purchased`,
  });
  if (!url) return { error: "Checkout is unavailable right now. Please try again later." };

  redirect(url);
}
