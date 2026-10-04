import { BadgeCheck, CheckCircle2 } from "lucide-react";
import type { Metadata } from "next";
import { headers } from "next/headers";

import { Logo } from "@/components/brand/logo";
import { Card, CardContent } from "@/components/ui/card";
import { formatCents } from "@/lib/money";
import { loadPublicPayment } from "@/lib/payment-request";

import { PayActions } from "./pay-actions";

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

          <div className="rounded-xl border bg-secondary/40 p-4 text-center">
            <p className="text-xs text-muted-foreground">Amount</p>
            <p className="text-2xl font-semibold text-primary tabular-nums">
              {formatCents(data.amountCents)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Reference {data.referenceCode}</p>
          </div>

          <PayActions
            methodLabel={data.methodLabel}
            bankName={data.bankName}
            maskedAccount={data.maskedAccount}
            fullAccount={data.fullAccount}
            accountLabel={data.fullAccountLabel}
          />

          <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
            <BadgeCheck className="size-3.5 shrink-0 text-primary" /> Pay from your own Juice app.
            lockedinnn never holds the money.
          </p>
        </CardContent>
      </Card>
    </Shell>
  );
}
