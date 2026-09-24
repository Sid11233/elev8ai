import type { Metadata } from "next";

import { requireOnboardedProfile } from "@/lib/auth";

export const metadata: Metadata = { title: "Jobs · Elev8ai" };

export default async function JobsPage() {
  const profile = await requireOnboardedProfile();

  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold">Welcome, {profile.full_name?.split(" ")[0]}</h1>
      <p className="text-muted-foreground">Jobs will show up here soon.</p>
    </div>
  );
}
