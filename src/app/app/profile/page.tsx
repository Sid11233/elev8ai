import type { Metadata } from "next";

import { PageHeader } from "@/components/page-header";
import { SignOutButton } from "@/components/sign-out-button";
import { Card, CardContent } from "@/components/ui/card";
import { UserAvatar } from "@/components/user-avatar";
import { requireOnboardedProfile } from "@/lib/auth";

export const metadata: Metadata = { title: "Profile · Elev8ai" };

export default async function ProfilePage() {
  const profile = await requireOnboardedProfile();

  const details = [
    { label: "Country", value: profile.country },
    { label: "Phone", value: profile.phone },
    { label: "Date of birth", value: profile.date_of_birth },
  ];

  return (
    <>
      <PageHeader title="Profile" />
      <div className="space-y-4">
        <Card>
          <CardContent className="flex items-center gap-4">
            <UserAvatar
              name={profile.full_name}
              src={profile.avatar_url}
              className="size-16 text-lg"
            />
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold">{profile.full_name}</p>
              <p className="truncate text-sm text-muted-foreground">@{profile.username}</p>
            </div>
          </CardContent>
        </Card>

        {profile.bio && (
          <Card>
            <CardContent>
              <p className="text-sm whitespace-pre-line">{profile.bio}</p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent>
            <dl className="divide-y">
              {details.map(({ label, value }) => (
                <div key={label} className="flex justify-between gap-4 py-2.5 text-sm">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="text-right">{value ?? "—"}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        <p className="text-sm text-muted-foreground">
          Badges, earnings and payout settings will appear here in later phases.
        </p>

        {/* On desktop, logout lives in the sidebar. */}
        <div className="md:hidden">
          <SignOutButton />
        </div>
      </div>
    </>
  );
}
