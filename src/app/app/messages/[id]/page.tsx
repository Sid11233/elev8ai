import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ChatThreadPage } from "@/components/chat/chat-thread-page";
import { getConversation } from "@/lib/chat";

export const metadata: Metadata = { title: "Chat · Elev8ai" };

export default async function TalentThreadPage({ params }: PageProps<"/app/messages/[id]">) {
  const { id } = await params;
  const conversation = await getConversation(id);
  if (!conversation) notFound();
  return (
    <ChatThreadPage
      conversation={conversation}
      backHref="/app/messages"
      jobHref={`/app/my-jobs/${conversation.applicationId}`}
    />
  );
}
