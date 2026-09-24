import { MessageCircle } from "lucide-react";
import type { Metadata } from "next";

import { ComingSoon } from "@/components/coming-soon";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Messages · Elev8ai" };

export default function MessagesPage() {
  return (
    <>
      <PageHeader
        title="Messages"
        description="Chat with the company about jobs you've been accepted for."
      />
      <ComingSoon
        icon={MessageCircle}
        text="When you're accepted for a job, a chat thread with the company opens here."
      />
    </>
  );
}
