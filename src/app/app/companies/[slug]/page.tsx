import { ArrowLeft, BadgeCheck, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CompanyLogo } from "@/components/company-logo";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { requireOnboardedProfile } from "@/lib/auth";
import { CATEGORY_LABELS, type JobCategory } from "@/lib/jobs";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Company · lockedinnn" };

export default async function PublicCompanyPage({ params }: PageProps<"/app/companies/[slug]">) {
  await requireOnboardedProfile();
  const { slug } = await params;
  const supabase = await createClient();
  const { data: company } = await supabase
    .from("companies")
    .select("id, name, slug, logo_url, description, website, type, services, verification_tier")
    .eq("slug", slug)
    .maybeSingle();
  if (!company) notFound();

  const { count: openJobs } = await supabase
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .eq("company_id", company.id)
    .eq("status", "open");

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link
        href="/app/jobs"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Jobs
      </Link>

      <Card>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3">
            <CompanyLogo name={company.name} src={company.logo_url} className="size-14" />
            <div className="min-w-0">
              <h1 className="text-xl leading-snug font-semibold">{company.name}</h1>
              <div className="flex flex-wrap items-center gap-2 pt-1 text-sm text-muted-foreground">
                {company.type && <span>{company.type}</span>}
                {company.verification_tier === "trusted" && (
                  <Badge className="border-0 bg-success/15 text-success">
                    <BadgeCheck className="size-3.5" /> Trusted
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {company.description && (
            <p className="text-sm leading-relaxed whitespace-pre-line">{company.description}</p>
          )}

          {company.services.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {company.services.map((s) => (
                <Badge key={s} variant="secondary">
                  {CATEGORY_LABELS[s as JobCategory] ?? s}
                </Badge>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <span className="tabular-nums">{openJobs ?? 0} open jobs</span>
            {company.website && (
              <a
                href={company.website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary"
              >
                Website <ExternalLink className="size-3.5" />
              </a>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
