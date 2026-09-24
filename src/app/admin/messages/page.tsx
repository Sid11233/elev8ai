import { MessageCircle } from "lucide-react";
import type { Metadata } from "next";

import { ComingSoon } from "@/components/coming-soon";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Messages · Admin · Elev8ai" };

export default function AdminMessagesPage() {
  return (
    <>
      <PageHeader title="Messages" description="Chat threads with talent on accepted jobs." />
      <ComingSoon icon={MessageCircle} text="The admin inbox arrives in Phase 4." />
    </>
  );
}
