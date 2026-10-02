import type { Metadata } from "next";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requireCompany } from "@/lib/auth";

import { CompanyProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Company profile · lockedinnn" };

export default async function CompanyProfilePage() {
  const { company } = await requireCompany();

  return (
    <>
      <PageHeader
        title="Company profile"
        description="This is what freelancers and other companies see. Keep it appealing."
      />
      <Card>
        <CardContent>
          <CompanyProfileForm
            defaults={{
              name: company.name ?? "",
              type: company.type ?? "",
              phone: company.phone ?? "",
              website: company.website ?? "",
              description: company.description ?? "",
              services: company.services ?? [],
            }}
          />
        </CardContent>
      </Card>
    </>
  );
}
