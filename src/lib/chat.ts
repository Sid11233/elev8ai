import "server-only";

import { getCurrentProfile, getCurrentUser } from "@/lib/auth";
import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

export type Message = Database["public"]["Tables"]["messages"]["Row"];

// Inbox rows for the current user (list_conversations() is RLS-scoped).
export async function getConversations() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("list_conversations");
  return data ?? [];
}

export async function getTotalUnreadMessages() {
  const rows = await getConversations();
  return rows.reduce((sum, r) => sum + (r.unread_count ?? 0), 0);
}

export type ChatMessage = Message & { attachmentUrl: string | null };

// A single thread the current user takes part in, or null. RLS returns no
// conversation row if they aren't a participant.
export async function getConversation(conversationId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(conversationId)) return null;
  const user = await getCurrentUser();
  const profile = await getCurrentProfile();
  if (!user || !profile) return null;
  const supabase = await createClient();

  const { data: conv } = await supabase
    .from("conversations")
    .select("id, application:applications(id, user_id, job:jobs(id, title, status))")
    .eq("id", conversationId)
    .maybeSingle();
  const app = conv?.application;
  if (!conv || !app?.job) return null;

  const { data: messages } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  // Sign the private attachments (participants only, per storage RLS).
  const paths = (messages ?? []).map((m) => m.attachment_path).filter((p): p is string => !!p);
  const signed = new Map<string, string>();
  if (paths.length) {
    const { data } = await supabase.storage
      .from("chat-attachments")
      .createSignedUrls(paths, 60 * 60);
    for (const item of data ?? [])
      if (item.path && item.signedUrl) signed.set(item.path, item.signedUrl);
  }

  // The other side's display name. Admins can read the talent's profile;
  // talent see their own name and label admins as the team.
  let talentName = "Talent";
  if (app.user_id === user.id) {
    talentName = profile.full_name ?? "You";
  } else {
    const { data: t } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", app.user_id)
      .single();
    talentName = t?.full_name ?? "Talent";
  }

  return {
    id: conv.id,
    jobId: app.job.id,
    jobTitle: app.job.title,
    applicationId: app.id,
    talentId: app.user_id,
    talentName,
    currentUserId: user.id,
    isAdmin: profile.role === "admin",
    messages: (messages ?? []).map((m) => ({
      ...m,
      attachmentUrl: m.attachment_path ? (signed.get(m.attachment_path) ?? null) : null,
    })),
  };
}

export type Conversation = NonNullable<Awaited<ReturnType<typeof getConversation>>>;
