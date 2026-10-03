"use client";

import { useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { setCompanyTier } from "./actions";

// Admin toggle between a capped 'new' company and an uncapped 'trusted' one.
export function TierControl({ companyId, tier }: { companyId: string; tier: string }) {
  const [pending, start] = useTransition();
  const trusted = tier === "trusted";

  return (
    <div className="flex items-center gap-2">
      <Badge
        className={
          trusted
            ? "border-0 bg-success/15 text-success"
            : "border-0 bg-warning/15 text-warning"
        }
      >
        {trusted ? "Trusted" : "New · capped"}
      </Badge>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => start(() => void setCompanyTier(companyId, trusted ? "new" : "trusted"))}
      >
        {trusted ? "Mark new" : "Promote to trusted"}
      </Button>
    </div>
  );
}
