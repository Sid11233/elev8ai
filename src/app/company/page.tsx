import { Briefcase, Inbox, Plus, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireCompany } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Overview · Company · Elev8ai" };

export default async function CompanyOverviewPage() {
  const { company } = await requireCompany();
  const supabase = await createClient();

  const jobIds = (await supabase.from("jobs").select("id").eq("company_id", company.id)).data ?? [];
  const ids = jobIds.map((j) => j.id);
  const [{ count: openJobs }, { count: pendingApps }] = await Promise.all([
    supabase
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .eq("company_id", company.id)
      .eq("status", "open"),
    ids.length
      ? supabase
          .from("applications")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending")
          .in("job_id", ids)
      : Promise.resolve({ count: 0 }),
  ]);

  return (
    <>
      <PageHeader
        title={company.name}
        description="Post jobs, hire freelancers, and manage your work."
      >
        <Button asChild className="h-10">
          <Link href="/company/jobs/new">
            <Plus className="size-4" /> New job
          </Link>
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Link href="/company/jobs" className="group">
          <Card className="h-full transition-colors group-hover:border-primary/40">
            <CardContent className="space-y-2">
              <Briefcase className="size-5 text-primary" />
              <p className="text-2xl font-semibold">{openJobs ?? 0}</p>
              <p className="text-xs text-muted-foreground">Open jobs</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/company/applications" className="group">
          <Card className="h-full transition-colors group-hover:border-primary/40">
            <CardContent className="space-y-2">
              <Inbox className="size-5 text-primary" />
              <p className="text-2xl font-semibold">{pendingApps ?? 0}</p>
              <p className="text-xs text-muted-foreground">Applications to review</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/company/find-work" className="group">
          <Card className="h-full transition-colors group-hover:border-primary/40">
            <CardContent className="space-y-2">
              <Search className="size-5 text-primary" />
              <p className="font-medium">Find work</p>
              <p className="text-xs text-muted-foreground">Apply to other companies&apos; jobs</p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </>
  );
}
