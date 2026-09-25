import type { Metadata } from "next";

import { ConversationList } from "@/components/chat/conversation-list";
import { PageHeader } from "@/components/page-header";
import { getPeople } from "@/lib/admin-people";
import { getConversations } from "@/lib/chat";

export const metadata: Metadata = { title: "Messages · Admin · Elev8ai" };

export default async function AdminMessagesPage() {
  const rows = await getConversations();
  const people = await getPeople(rows.map((r) => r.talent_id).filter((id): id is string => !!id));

  return (
    <>
      <PageHeader title="Messages" description="Chat threads with talent on accepted jobs." />
      <ConversationList
        rows={rows.map((r) => ({
          ...r,
          subtitle: (r.talent_id ? people.get(r.talent_id)?.full_name : undefined) ?? undefined,
        }))}
        basePath="/admin/messages"
        emptyText="Threads open when you accept an applicant. None yet."
      />
    </>
  );
}
