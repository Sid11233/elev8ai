"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import { markNotificationRead } from "@/app/app/notifications/actions";
import { relativeTime } from "@/lib/relative-time";
import { createClient } from "@/lib/supabase/client";
import type { Notification } from "@/lib/notifications";
import { cn } from "@/lib/utils";

// Header bell: live unread count and a dropdown of the latest notifications.
export function NotificationBell({
  userId,
  initialItems,
  initialUnread,
  allHref = "/app/notifications",
}: {
  userId: string;
  initialItems: Notification[];
  initialUnread: number;
  allHref?: string;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [unread, setUnread] = useState(initialUnread);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  // Unique per instance: two bells can render at once (admin sidebar + mobile
  // header), and Supabase rejects a second channel that reuses a name.
  const channelId = useId();

  // Live: prepend new notifications and bump the count.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`notifications-${userId}-${channelId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as Notification;
          setItems((prev) => [row, ...prev].slice(0, 10));
          setUnread((n) => n + 1);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, channelId]);

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function openItem(n: Notification) {
    setOpen(false);
    if (!n.read_at) {
      setItems((prev) =>
        prev.map((i) => (i.id === n.id ? { ...i, read_at: new Date().toISOString() } : i)),
      );
      setUnread((c) => Math.max(0, c - 1));
      await markNotificationRead(n.id);
    }
    router.push(n.link ?? allHref);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={open}
        className="relative inline-flex size-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <Bell className="size-5" />
        {unread > 0 && (
          <span className="absolute top-1.5 right-1.5 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] leading-4 font-bold text-primary-foreground">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border bg-popover shadow-lg">
          <div className="border-b px-4 py-2.5 text-sm font-medium">Notifications</div>
          {items.length ? (
            <ul className="max-h-96 divide-y overflow-y-auto">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => openItem(n)}
                    className={cn(
                      "flex w-full flex-col gap-0.5 px-4 py-3 text-left transition-colors hover:bg-accent",
                      !n.read_at && "bg-primary/5",
                    )}
                  >
                    <span className="flex items-center gap-2 text-sm font-medium">
                      {!n.read_at && <span className="size-2 shrink-0 rounded-full bg-primary" />}
                      {n.title}
                    </span>
                    {n.body && (
                      <span className="line-clamp-2 text-xs text-muted-foreground">{n.body}</span>
                    )}
                    <span className="text-[11px] text-muted-foreground">
                      {relativeTime(n.created_at)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              No notifications yet.
            </p>
          )}
          <Link
            href={allHref}
            onClick={() => setOpen(false)}
            className="block border-t px-4 py-2.5 text-center text-sm font-medium text-primary hover:bg-accent"
          >
            See all
          </Link>
        </div>
      )}
    </div>
  );
}
