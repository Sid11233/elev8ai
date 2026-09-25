import type { Metadata } from "next";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { UserAvatar } from "@/components/user-avatar";
import { createClient } from "@/lib/supabase/server";

import { BadgeControl } from "./badge-control";

export const metadata: Metadata = { title: "Users · Admin · Elev8ai" };

export default async function AdminUsersPage() {
  const supabase = await createClient();
  const [{ data: profiles }, { data: skills }, { data: userSkills }] = await Promise.all([
    supabase
      .from("profiles")
      .select("user_id, full_name, username, avatar_url, country, role")
      .order("created_at", { ascending: false })
      .limit(500),
    supabase.from("skills").select("id, name").order("name"),
    supabase.from("user_skills").select("user_id, skill_id, skill:skills(name)"),
  ]);

  const badgesByUser = new Map<string, { skill_id: string; name: string }[]>();
  for (const us of userSkills ?? []) {
    if (!us.skill) continue;
    const list = badgesByUser.get(us.user_id) ?? [];
    list.push({ skill_id: us.skill_id, name: us.skill.name });
    badgesByUser.set(us.user_id, list);
  }

  return (
    <>
      <PageHeader
        title="Users"
        description={`${profiles?.length ?? 0} people. Award or revoke badges manually.`}
      />
      <div className="space-y-3">
        {(profiles ?? []).map((p) => (
          <Card key={p.user_id}>
            <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <UserAvatar name={p.full_name} src={p.avatar_url} />
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    {p.full_name}
                    {p.role === "admin" && (
                      <Badge className="border-0 bg-secondary text-muted-foreground">Admin</Badge>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    @{p.username} · {p.country}
                  </p>
                </div>
              </div>
              <BadgeControl
                userId={p.user_id}
                badges={badgesByUser.get(p.user_id) ?? []}
                allSkills={skills ?? []}
              />
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
