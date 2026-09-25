import "server-only";

import { render } from "@react-email/components";
import { after } from "next/server";
import { Resend } from "resend";

import { NotificationEmail } from "@/emails/notification-email";
import { createAdminClient } from "@/lib/supabase/admin";

type NotifyInput = {
  userId: string;
  type: string;
  title: string;
  body?: string | null;
  link?: string | null;
  // Skip the email even if the user is opted in (e.g. throttled new-message emails).
  skipEmail?: boolean;
};

function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

// Inserts a notification (bell) and, unless opted out, sends a branded email.
// Uses the service role: notifications are not user-writable. Never throws to
// the caller — a failed email must not roll back the action that triggered it.
export async function notify({ userId, type, title, body, link, skipEmail }: NotifyInput) {
  const supabase = createAdminClient();

  const { data: row, error } = await supabase
    .from("notifications")
    .insert({ user_id: userId, type, title, body: body ?? null, link: link ?? null })
    .select("id")
    .single();
  if (error || !row) {
    console.error("notify: failed to insert notification", error);
    return;
  }

  if (skipEmail) return;

  // Send the email after the response so a slow Resend call never delays the
  // action that triggered the notification. The bell row is already saved.
  after(() => sendEmail(row.id, userId, title, body, link));
}

async function sendEmail(
  notificationId: string,
  userId: string,
  title: string,
  body: string | null | undefined,
  link: string | null | undefined,
) {
  const supabase = createAdminClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("email_opt_out")
    .eq("user_id", userId)
    .single();
  if (profile?.email_opt_out) return;

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) return; // email not configured yet

  const { data: userInfo } = await supabase.auth.admin.getUserById(userId);
  const email = userInfo?.user?.email;
  if (!email) return;

  const actionUrl = link ? `${appUrl()}${link}` : appUrl();
  try {
    const html = await render(
      NotificationEmail({ title, body, actionUrl, preview: body ?? title }),
    );
    const resend = new Resend(apiKey);
    const sent = await resend.emails.send({ from, to: email, subject: title, html });
    if (!sent.error) {
      await supabase
        .from("notifications")
        .update({ emailed_at: new Date().toISOString() })
        .eq("id", notificationId);
    }
  } catch (err) {
    console.error("notify: failed to send email", err);
  }
}

// Fan out to several users (e.g. admins), ignoring individual failures.
export async function notifyMany(userIds: string[], input: Omit<NotifyInput, "userId">) {
  await Promise.all([...new Set(userIds)].map((userId) => notify({ ...input, userId })));
}

// Admin user ids, for "new application / submission / assignment" alerts.
export async function getAdminUserIds(): Promise<string[]> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("profiles").select("user_id").eq("role", "admin");
  return (data ?? []).map((p) => p.user_id);
}
