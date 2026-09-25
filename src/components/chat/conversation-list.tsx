import { MessageCircle, Paperclip } from "lucide-react";
import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import { relativeTime } from "@/lib/relative-time";
import { cn } from "@/lib/utils";

export type ConversationRow = {
  conversation_id: string;
  job_title: string | null;
  last_message: string | null;
  last_message_has_attachment: boolean | null;
  last_message_at: string | null;
  unread_count: number | null;
  subtitle?: string; // e.g. talent name (admin) or company (talent)
};

export function ConversationList({
  rows,
  basePath,
  emptyText,
}: {
  rows: ConversationRow[];
  basePath: string;
  emptyText: string;
}) {
  if (!rows.length) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <MessageCircle className="size-8 text-muted-foreground" />
          <p className="max-w-sm text-sm text-muted-foreground">{emptyText}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <ul className="divide-y">
          {rows.map((row) => {
            const unread = (row.unread_count ?? 0) > 0;
            return (
              <li key={row.conversation_id}>
                <Link
                  href={`${basePath}/${row.conversation_id}`}
                  className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-accent"
                >
                  <div className="min-w-0 flex-1">
                    <p className={cn("truncate text-sm", unread ? "font-semibold" : "font-medium")}>
                      {row.job_title ?? "Job"}
                    </p>
                    {row.subtitle && (
                      <p className="truncate text-xs text-muted-foreground">{row.subtitle}</p>
                    )}
                    <p
                      className={cn(
                        "flex items-center gap-1 truncate text-sm",
                        unread ? "text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {row.last_message_has_attachment && <Paperclip className="size-3 shrink-0" />}
                      {row.last_message ?? "No messages yet"}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {row.last_message_at && (
                      <span className="text-[11px] text-muted-foreground">
                        {relativeTime(row.last_message_at)}
                      </span>
                    )}
                    {unread && (
                      <span className="flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground">
                        {row.unread_count}
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
