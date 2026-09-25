import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { ChatThread } from "@/components/chat/chat-thread";
import type { Conversation } from "@/lib/chat";

// Full-height thread view: header, the live thread, and an "Open job" link.
export function ChatThreadPage({
  conversation,
  backHref,
  jobHref,
  subtitle,
}: {
  conversation: Conversation;
  backHref: string;
  jobHref: string;
  subtitle?: string;
}) {
  return (
    // Fill the area between the app header and (on phones) the bottom nav.
    <div className="flex h-[calc(100dvh-8.5rem)] flex-col md:h-[calc(100dvh-6.5rem)]">
      <div className="flex items-center gap-3 border-b pb-3">
        <Link
          href={backHref}
          aria-label="Back to messages"
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{conversation.jobTitle}</p>
          {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <Link href={jobHref} className="shrink-0 text-sm font-medium text-primary">
          Open job
        </Link>
      </div>
      <ChatThread conversation={conversation} />
    </div>
  );
}
