import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { SignOutButton } from "@/components/sign-out-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { UserAvatar } from "@/components/user-avatar";
import { getCurrentUser, requireOnboardedProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Profile · Elev8ai" };

export default async function ProfilePage() {
  const profile = await requireOnboardedProfile();
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data: badges } = await supabase
    .from("user_skills")
    .select("skill:skills(name)")
    .eq("user_id", user?.id ?? "");
  const badgeNames = (badges ?? []).map((b) => b.skill?.name).filter((n): n is string => !!n);

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

        <Card>
          <CardContent className="space-y-2">
            <p className="text-sm font-medium">Badges</p>
            {badgeNames.length ? (
              <div className="flex flex-wrap gap-1.5">
                {badgeNames.map((name) => (
                  <Badge key={name} className="border-0 bg-primary/15 text-primary">
                    {name}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No badges yet. Pass a course to earn one and unlock better jobs.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="divide-y">
            <Link
              href="/app/earnings"
              className="flex items-center justify-between py-1 text-sm font-medium"
            >
              Earnings <span className="text-primary">→</span>
            </Link>
            <Link
              href="/app/settings/payout"
              className="flex items-center justify-between pt-3 text-sm font-medium"
            >
              Payout details <span className="text-primary">→</span>
            </Link>
          </CardContent>
        </Card>

        {/* On desktop, logout lives in the sidebar. */}
        <div className="md:hidden">
          <SignOutButton />
        </div>
      </div>
    </>
  );
}
