import type { Metadata } from "next";

import { ConversationList } from "@/components/chat/conversation-list";
import { PageHeader } from "@/components/page-header";
import { getPeople } from "@/lib/admin-people";
import { requireCompany } from "@/lib/auth";
import { getConversations } from "@/lib/chat";

export const metadata: Metadata = { title: "Messages · Company · lockedinnn" };

export default async function CompanyMessagesPage() {
  await requireCompany();
  const rows = await getConversations();
  const people = await getPeople(rows.map((r) => r.talent_id).filter((id): id is string => !!id));
  return (
    <>
      <PageHeader title="Messages" description="Chat with freelancers on your jobs." />
      <ConversationList
        rows={rows.map((r) => ({
          ...r,
          subtitle: (r.talent_id ? people.get(r.talent_id)?.full_name : undefined) ?? undefined,
        }))}
        basePath="/company/messages"
        emptyText="Threads open when you accept an applicant. None yet."
      />
    </>
  );
}
