import type { Metadata } from "next";

import { ConversationList } from "@/components/chat/conversation-list";
import { PageHeader } from "@/components/page-header";
import { getConversations } from "@/lib/chat";

export const metadata: Metadata = { title: "Messages · Elev8ai" };

export default async function MessagesPage() {
  const rows = await getConversations();
  return (
    <>
      <PageHeader title="Messages" description="Chat with the company about your accepted jobs." />
      <ConversationList
        rows={rows.map((r) => ({ ...r, subtitle: undefined }))}
        basePath="/app/messages"
        emptyText="When you're accepted for a job, a chat thread with the company opens here."
      />
    </>
  );
}
