import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ChatThreadPage } from "@/components/chat/chat-thread-page";
import { getConversation } from "@/lib/chat";

export const metadata: Metadata = { title: "Chat · Admin · Elev8ai" };

export default async function AdminThreadPage({ params }: PageProps<"/admin/messages/[id]">) {
  const { id } = await params;
  const conversation = await getConversation(id);
  if (!conversation) notFound();
  return (
    <ChatThreadPage
      conversation={conversation}
      backHref="/admin/messages"
      jobHref={`/admin/jobs/${conversation.jobId}`}
      subtitle={conversation.talentName}
    />
  );
}
