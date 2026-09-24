import { Bell } from "lucide-react";
import Link from "next/link";

// Placeholder: the live unread count and dropdown arrive in Phase 4b.
export function NotificationBell({ href, unread = 0 }: { href: string; unread?: number }) {
  return (
    <Link
      href={href}
      aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
      className="relative inline-flex size-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      <Bell className="size-5" />
      {unread > 0 && (
        <span className="absolute top-1.5 right-1.5 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] leading-4 font-bold text-primary-foreground">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}
