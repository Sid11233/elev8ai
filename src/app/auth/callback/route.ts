import type { EmailOtpType } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";

import { track } from "@/lib/analytics";
import { homePathFor, safeNextPath } from "@/lib/auth";
import { relativeRedirect } from "@/lib/relative-redirect";
import { createClient } from "@/lib/supabase/server";

// Finishes a login from a magic link or Google, then sends the user where they belong.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const next = safeNextPath(params.get("next"));
  const supabase = await createClient();

  const code = params.get("code");
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;

  let userId: string | undefined;
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    userId = error ? undefined : data.user.id;
  } else if (tokenHash && type) {
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    userId = error ? undefined : data.user?.id;
  }

  if (!userId) return relativeRedirect("/login?error=link");

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarded, role, created_at")
    .eq("user_id", userId)
    .single();

  // Fresh account (profile created moments ago) -> count it as a sign-up.
  if (
    profile &&
    !profile.onboarded &&
    Date.now() - new Date(profile.created_at).getTime() < 120_000
  ) {
    track("signed_up", userId);
  }

  const destination =
    profile?.onboarded && next
      ? next
      : homePathFor(profile ?? { onboarded: false, role: "talent" });
  return relativeRedirect(destination);
}
