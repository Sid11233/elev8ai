import { BadgeCheck, CheckCircle2 } from "lucide-react";
import type { Metadata } from "next";
import { headers } from "next/headers";

import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatCents } from "@/lib/money";
import { loadPublicPayment } from "@/lib/payment-request";

// Public, unauthenticated, never indexed, never cached.
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Pay a freelancer · lockedinnn",
  robots: { index: false, follow: false },
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="mb-6">
        <Logo href="/" />
      </div>
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}

export default async function PublicPaymentPage({ params }: PageProps<"/p/[username]/[token]">) {
  const { token } = await params;
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  const data = await loadPublicPayment(token, ip);

  if (data.state === "rate_limited") {
    return (
      <Shell>
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Too many requests. Wait a minute and try again.
          </CardContent>
        </Card>
      </Shell>
    );
  }

  if (data.state === "not_found") {
    return (
      <Shell>
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            This payment link is invalid or has expired.
          </CardContent>
        </Card>
      </Shell>
    );
  }

  if (data.state === "confirmed") {
    return (
      <Shell>
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <CheckCircle2 className="size-8 text-success" />
            <p className="font-medium">This job is already paid.</p>
            <p className="text-sm text-muted-foreground">Reference {data.referenceCode}</p>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  return (
    <Shell>
      <Card>
        <CardContent className="space-y-5">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Pay</p>
            <h1 className="text-xl font-semibold">{data.payeeName}</h1>
          </div>

          <div className="space-y-1 text-center">
            <p className="text-sm font-medium">{data.methodLabel}</p>
            {data.bankName && <p className="text-sm text-muted-foreground">{data.bankName}</p>}
            <p className="text-sm text-muted-foreground">Account ending {data.maskedAccount}</p>
          </div>

          <div className="rounded-xl border bg-secondary/40 p-4 text-center">
            <p className="text-xs text-muted-foreground">Amount</p>
            <p className="text-2xl font-semibold text-primary tabular-nums">
              {formatCents(data.amountCents)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Reference {data.referenceCode}</p>
          </div>

          <Button asChild className="h-11 w-full">
            <a href="https://www.mcb.mu/en/juice/" target="_blank" rel="noopener noreferrer">
              Open MCB Juice
            </a>
          </Button>

          <details className="rounded-lg border p-3 text-sm">
            <summary className="cursor-pointer font-medium">Full payment details</summary>
            <dl className="mt-2 space-y-1">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Name</dt>
                <dd className="text-right">{data.payeeName}</dd>
              </div>
              {data.fullDetails.map((d) => (
                <div key={d.label} className="flex justify-between gap-3">
                  <dt className="capitalize text-muted-foreground">{d.label}</dt>
                  <dd className="text-right break-all">{d.value}</dd>
                </div>
              ))}
            </dl>
          </details>

          <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <BadgeCheck className="size-3.5 text-primary" /> Pay from your own Juice app. lockedinnn
            never holds the money.
          </p>
        </CardContent>
      </Card>
    </Shell>
  );
}
