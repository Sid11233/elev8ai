import { getCurrentUser } from "@/lib/auth";
import { getRecentNotifications, getUnreadCount } from "@/lib/notifications";

import { NotificationBell } from "./notification-bell";

// Server wrapper: fetches the current user's recent notifications and unread
// count, then hands them to the live client bell.
export async function NotificationBellServer() {
  const user = await getCurrentUser();
  if (!user) return null;
  const [items, unread] = await Promise.all([getRecentNotifications(10), getUnreadCount()]);
  return <NotificationBell userId={user.id} initialItems={items} initialUnread={unread} />;
}
