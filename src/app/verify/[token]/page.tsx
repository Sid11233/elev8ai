import { BadgeCheck, XCircle } from "lucide-react";
import type { Metadata } from "next";

import { Logo } from "@/components/brand/logo";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/datetime";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Verify certificate · lockedinnn",
  robots: { index: false, follow: false },
};

export default async function VerifyCertificatePage({ params }: PageProps<"/verify/[token]">) {
  const { token } = await params;
  // Public page: read with the service role, expose only name/title/date/status.
  const admin = createAdminClient();
  const { data: cert } = /^[a-f0-9]{16,64}$/.test(token)
    ? await admin
        .from("certificates")
        .select("title, issued_at, status, user_id")
        .eq("verify_token", token)
        .maybeSingle()
    : { data: null };

  const holder = cert
    ? (await admin.from("profiles").select("full_name").eq("user_id", cert.user_id).maybeSingle())
        .data
    : null;

  const valid = cert?.status === "valid";

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="mb-6">
        <Logo href="/" />
      </div>
      <div className="w-full max-w-sm">
        <Card>
          <CardContent className="space-y-3 py-8 text-center">
            {!cert ? (
              <>
                <XCircle className="mx-auto size-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  No certificate matches this link.
                </p>
              </>
            ) : (
              <>
                {valid ? (
                  <BadgeCheck className="mx-auto size-10 text-success" />
                ) : (
                  <XCircle className="mx-auto size-10 text-destructive" />
                )}
                <p className="text-xs tracking-wide text-muted-foreground uppercase">
                  {valid ? "Valid certificate" : "Revoked"}
                </p>
                <h1 className="text-lg font-semibold">{cert.title}</h1>
                <p className="text-sm">{holder?.full_name ?? "Holder"}</p>
                {cert.issued_at && (
                  <p className="text-sm text-muted-foreground">Issued {formatDate(cert.issued_at)}</p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
