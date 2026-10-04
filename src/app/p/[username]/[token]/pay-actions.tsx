"use client";

import { Check, Copy, Eye, EyeOff } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

// Account number stays masked by default; the payer can reveal it (after a
// verify warning) and/or copy the full value to paste into their Juice app.
export function PayActions({
  methodLabel,
  bankName,
  maskedAccount,
  fullAccount,
  accountLabel,
}: {
  methodLabel: string;
  bankName: string | null;
  maskedAccount: string;
  fullAccount: string;
  accountLabel: string;
}) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(fullAccount);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked (e.g. insecure context) — reveal so it can be copied by hand
      setRevealed(true);
    }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border bg-secondary/40 p-4 text-center">
        <p className="text-sm font-medium">{methodLabel}</p>
        {bankName && <p className="text-sm text-muted-foreground">{bankName}</p>}
        <p className="mt-1 text-xs tracking-wide text-muted-foreground uppercase">{accountLabel}</p>
        <p className="font-mono text-lg font-semibold break-all tabular-nums">
          {revealed ? fullAccount || "—" : maskedAccount}
        </p>
      </div>

      {revealed && (
        <p className="text-center text-xs text-warning">
          Verify the recipient name and account details before making your payment.
        </p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" className="h-11" onClick={() => setRevealed((v) => !v)}>
          {revealed ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          {revealed ? "Hide" : "Show number"}
        </Button>
        <Button type="button" variant="outline" className="h-11" onClick={copy}>
          {copied ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
          {copied ? "Copied" : "Copy number"}
        </Button>
      </div>

      <Button asChild className="h-11 w-full">
        <a href="https://www.mcb.mu/en/juice/" target="_blank" rel="noopener noreferrer">
          Open MCB Juice
        </a>
      </Button>
    </div>
  );
}
