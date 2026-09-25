import { ExternalLink, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { CompanyLogo } from "@/components/company-logo";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Companies · Admin · Elev8ai" };

export default async function AdminCompaniesPage() {
  const supabase = await createClient();
  const { data: companies } = await supabase
    .from("companies")
    .select("*, jobs(count)")
    .order("name");

  return (
    <>
      <PageHeader title="Companies" description="The companies that post jobs on Elev8ai.">
        <Button asChild className="h-10">
          <Link href="/admin/companies/new">
            <Plus className="size-4" /> New company
          </Link>
        </Button>
      </PageHeader>

      <div className="grid gap-3 sm:grid-cols-2">
        {(companies ?? []).map((company) => (
          <Card key={company.id}>
            <CardContent className="flex gap-4">
              <CompanyLogo name={company.name} src={company.logo_url} className="size-12" />
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={`/admin/companies/${company.id}`}
                    className="font-medium hover:underline"
                  >
                    {company.name}
                  </Link>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {company.jobs[0]?.count ?? 0} jobs
                  </span>
                </div>
                {company.description && (
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {company.description}
                  </p>
                )}
                <div className="flex gap-4 pt-1 text-sm">
                  <Link href={`/admin/companies/${company.id}`} className="text-primary">
                    Edit
                  </Link>
                  {company.website && (
                    <a
                      href={company.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                    >
                      Website <ExternalLink className="size-3" />
                    </a>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
