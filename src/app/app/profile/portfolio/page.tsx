import { ArrowLeft, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser, requireOnboardedProfile } from "@/lib/auth";
import { formatDate } from "@/lib/datetime";
import { createClient } from "@/lib/supabase/server";

import {
  AddCertificateForm,
  AddPortfolioForm,
  PortfolioItemActions,
} from "./portfolio-manager";

export const metadata: Metadata = { title: "Portfolio & certificates · lockedinnn" };

export default async function PortfolioPage() {
  await requireOnboardedProfile();
  const user = await getCurrentUser();
  const supabase = await createClient();
  const [{ data: items }, { data: certs }] = await Promise.all([
    supabase
      .from("portfolio_items")
      .select("*")
      .eq("user_id", user?.id ?? "")
      .order("created_at", { ascending: false }),
    supabase
      .from("certificates")
      .select("*")
      .eq("user_id", user?.id ?? "")
      .order("created_at", { ascending: false }),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link
        href="/app/profile"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Profile
      </Link>
      <PageHeader
        title="Portfolio & certificates"
        description="Companies see these when you apply. Originals stay private — they only see watermarked previews."
      />

      <Card>
        <CardHeader>
          <CardTitle>Add to portfolio</CardTitle>
        </CardHeader>
        <CardContent>
          <AddPortfolioForm userId={user?.id ?? ""} />
        </CardContent>
      </Card>

      {(items ?? []).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Your portfolio</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(items ?? []).map((it) => (
              <div
                key={it.id}
                className="flex items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {it.title || (it.kind === "link" ? it.url : "Untitled")}
                  </p>
                  <p className="text-xs text-muted-foreground">{it.kind}</p>
                </div>
                <PortfolioItemActions id={it.id} visibility={it.visibility} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Certificates</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {(certs ?? []).length > 0 && (
            <ul className="space-y-2">
              {(certs ?? []).map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{c.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.issued_at ? formatDate(c.issued_at) : "—"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {c.kind === "platform" ? (
                      <Badge className="border-0 bg-success/15 text-success">Verified</Badge>
                    ) : c.status === "valid" ? (
                      <Badge className="border-0 bg-success/15 text-success">Verified</Badge>
                    ) : (
                      <Badge variant="secondary">Unverified</Badge>
                    )}
                    {c.verify_token && (
                      <a
                        href={`/verify/${c.verify_token}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary"
                      >
                        Verify <ExternalLink className="size-3" />
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div>
            <p className="mb-2 text-sm font-medium">Upload an external certificate</p>
            <AddCertificateForm userId={user?.id ?? ""} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
