import { Bell } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { relativeTime } from "@/lib/relative-time";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

import { markAllNotificationsRead } from "./actions";

export const metadata: Metadata = { title: "Notifications · Elev8ai" };

export default async function NotificationsPage() {
  await requireUser();
  const supabase = await createClient();
  const { data: notifications } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  const list = notifications ?? [];
  const hasUnread = list.some((n) => !n.read_at);

  return (
    <>
      <PageHeader title="Notifications">
        {hasUnread && (
          <form action={markAllNotificationsRead}>
            <Button type="submit" variant="outline" size="sm">
              Mark all as read
            </Button>
          </form>
        )}
      </PageHeader>

      {list.length ? (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y">
              {list.map((n) => {
                const inner = (
                  <div
                    className={cn(
                      "flex flex-col gap-0.5 px-4 py-3.5 transition-colors",
                      n.link && "hover:bg-accent",
                      !n.read_at && "bg-primary/5",
                    )}
                  >
                    <span className="flex items-center gap-2 text-sm font-medium">
                      {!n.read_at && <span className="size-2 shrink-0 rounded-full bg-primary" />}
                      {n.title}
                    </span>
                    {n.body && <span className="text-sm text-muted-foreground">{n.body}</span>}
                    <span className="text-xs text-muted-foreground">
                      {relativeTime(n.created_at)}
                    </span>
                  </div>
                );
                return <li key={n.id}>{n.link ? <Link href={n.link}>{inner}</Link> : inner}</li>;
              })}
            </ul>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Bell className="size-6" />
            </span>
            <p className="text-sm text-muted-foreground">
              No notifications yet. We&apos;ll let you know when something happens.
            </p>
          </CardContent>
        </Card>
      )}
    </>
  );
}
