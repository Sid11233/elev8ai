import { Users } from "lucide-react";
import type { Metadata } from "next";

import { ComingSoon } from "@/components/coming-soon";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Users · Admin · Elev8ai" };

export default function AdminUsersPage() {
  return (
    <>
      <PageHeader
        title="Users"
        description="Everyone on Elev8ai, their badges and payout details."
      />
      <ComingSoon icon={Users} text="User management and manual badge awards arrive in Phase 6." />
    </>
  );
}
