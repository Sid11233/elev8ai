import { Building2, ExternalLink } from "lucide-react";

import { CompanyLogo } from "@/components/company-logo";
import { Badge } from "@/components/ui/badge";
import type { ApplicantCompany } from "@/lib/applicant-companies";
import { CATEGORY_LABELS, type JobCategory } from "@/lib/jobs";

// The applying company's profile, shown to whoever is reviewing applications.
export function ApplicantCompanyLine({ company }: { company: ApplicantCompany }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <CompanyLogo name={company.name} src={company.logo_url} />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            {company.name}{" "}
            <span className="inline-flex items-center gap-1 align-middle text-xs font-normal text-muted-foreground">
              <Building2 className="size-3" /> Company
            </span>
          </p>
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            {company.type && <span>{company.type}</span>}
            {company.services.map((s) => (
              <Badge key={s} variant="secondary">
                {CATEGORY_LABELS[s as JobCategory] ?? s}
              </Badge>
            ))}
          </div>
        </div>
      </div>
      {company.description && (
        <p className="text-sm whitespace-pre-line text-muted-foreground">{company.description}</p>
      )}
      {company.website && (
        <a
          href={company.website}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-primary"
        >
          Website <ExternalLink className="size-3.5" />
        </a>
      )}
    </div>
  );
}
