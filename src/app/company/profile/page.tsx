import type { Metadata } from "next";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireCompany } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

import { CompanyBankForm } from "./bank-form";
import { CompanyProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Company profile · lockedinnn" };

export default async function CompanyProfilePage() {
  const { company } = await requireCompany();
  const supabase = await createClient();
  const { data: bank } = await supabase
    .from("company_bank_details")
    .select("beneficiary_name, bank_name, account_number")
    .eq("company_id", company.id)
    .maybeSingle();

  return (
    <>
      <PageHeader
        title="Company profile"
        description="This is what freelancers and other companies see. Keep it appealing."
      />
      <div className="space-y-6">
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

        <Card>
          <CardHeader>
            <CardTitle>Bank details (for refunds)</CardTitle>
          </CardHeader>
          <CardContent>
            <CompanyBankForm
              defaults={{
                beneficiary_name: bank?.beneficiary_name ?? "",
                bank_name: bank?.bank_name ?? "",
                account_number: bank?.account_number ?? "",
              }}
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
