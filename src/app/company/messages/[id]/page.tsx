import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ChatThreadPage } from "@/components/chat/chat-thread-page";
import { requireCompany } from "@/lib/auth";
import { getConversation } from "@/lib/chat";

export const metadata: Metadata = { title: "Chat · Company · Elev8ai" };

export default async function CompanyThreadPage({ params }: PageProps<"/company/messages/[id]">) {
  await requireCompany();
  const { id } = await params;
  const conversation = await getConversation(id);
  if (!conversation) notFound();
  return (
    <ChatThreadPage
      conversation={conversation}
      backHref="/company/messages"
      jobHref={`/company/jobs/${conversation.jobId}`}
      subtitle={conversation.talentName}
    />
  );
}
