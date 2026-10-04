"use server";

import { z } from "zod";

import { requireOnboardedProfile } from "@/lib/auth";
import { hasBlockedDeliveryLink } from "@/lib/delivery-guard";
import { notifyNewMessage } from "@/lib/notify-events";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/lib/validation/form-state";

const messageSchema = z
  .object({
    body: z.string().trim().max(4000, "Message is too long"),
    attachment_path: z.string().max(500).optional(),
  })
  .refine((m) => m.body.length > 0 || m.attachment_path, {
    message: "Type a message first",
    path: ["body"],
  });

// Sends one chat message. RLS enforces participant + sender = self, and that
// any attachment lives in this conversation's folder.
export async function sendMessage(
  conversationId: string,
  _prev: FormState<"body">,
  formData: FormData,
): Promise<FormState<"body">> {
  const profile = await requireOnboardedProfile();
  const parsed = messageSchema.safeParse({
    body: String(formData.get("body") ?? ""),
    attachment_path: (formData.get("attachment_path") as string) || undefined,
  });
  if (!parsed.success) {
    return { fieldErrors: { body: parsed.error.issues[0].message } };
  }

  const supabase = await createClient();

  // Delivery-leak rule: while a payment request is open (from acceptance until
  // settled), the talent can't send storage/transfer links or attachments in
  // chat — the deliverable must go through Submit. Company messages are exempt.
  const { data: convo } = await supabase
    .from("conversations")
    .select("application:applications(id, user_id, status)")
    .eq("id", conversationId)
    .maybeSingle();
  const app = convo?.application;
  if (app && app.user_id === profile.user_id && app.status === "accepted") {
    const { data: pr } = await supabase
      .from("payment_requests")
      .select("resolution")
      .eq("application_id", app.id)
      .maybeSingle();
    const paymentOpen = !pr || pr.resolution === null;
    if (paymentOpen) {
      if (parsed.data.attachment_path) {
        return {
          fieldErrors: {
            body: "You can't attach files in chat until payment is settled. Deliver through the Submit button — files sent in chat aren't protected.",
          },
        };
      }
      if (hasBlockedDeliveryLink(parsed.data.body)) {
        return {
          fieldErrors: {
            body: "Storage or transfer links aren't allowed here until payment is settled. Deliver through the Submit button.",
          },
        };
      }
    }
  }

  const { error } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    sender_id: profile.user_id,
    body: parsed.data.body,
    attachment_path: parsed.data.attachment_path ?? null,
  });
  if (error) return { message: "Couldn't send your message. Try again." };

  await notifyNewMessage(conversationId, profile.user_id);
  return {};
}

export async function markConversationRead(conversationId: string) {
  await requireOnboardedProfile();
  const supabase = await createClient();
  await supabase.rpc("mark_conversation_read", { p_conversation_id: conversationId });
}
