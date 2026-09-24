import { Bell } from "lucide-react";
import type { Metadata } from "next";

import { ComingSoon } from "@/components/coming-soon";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Notifications · Elev8ai" };

export default function NotificationsPage() {
  return (
    <>
      <PageHeader
        title="Notifications"
        description="Updates on your applications, work and payouts."
      />
      <ComingSoon
        icon={Bell}
        text="You're all caught up. Updates about your jobs and payouts will appear here."
      />
    </>
  );
}
