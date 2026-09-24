import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { homePathFor, safeNextPath } from "@/lib/auth";
import { getRequestOrigin } from "@/lib/request-origin";
import { createClient } from "@/lib/supabase/server";

// Finishes a login from a magic link or Google, then sends the user where they belong.
export async function GET(request: NextRequest) {
  const origin = getRequestOrigin(request.headers);
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

  if (!userId) return NextResponse.redirect(new URL("/login?error=link", origin));

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarded, role")
    .eq("user_id", userId)
    .single();

  const destination =
    profile?.onboarded && next
      ? next
      : homePathFor(profile ?? { onboarded: false, role: "talent" });
  return NextResponse.redirect(new URL(destination, origin));
}
