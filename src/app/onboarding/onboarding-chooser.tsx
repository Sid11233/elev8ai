"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

import { CompanyOnboardingForm } from "./company-form";
import { OnboardingForm } from "./onboarding-form";

type Tab = "freelancer" | "company";

export function OnboardingChooser({
  defaults,
  maxBirthDate,
}: {
  defaults: { full_name?: string | null; country?: string | null };
  maxBirthDate: string;
}) {
  const [tab, setTab] = useState<Tab>("freelancer");

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2">
        {(
          [
            ["freelancer", "I'm a freelancer", "Find and do paid work"],
            ["company", "I'm hiring", "Post jobs, hire freelancers"],
          ] as const
        ).map(([value, label, sub]) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            aria-pressed={tab === value}
            className={cn(
              "rounded-xl border p-3 text-left transition-colors",
              tab === value ? "border-primary bg-primary/10" : "hover:border-foreground/30",
            )}
          >
            <span className="block text-sm font-semibold">{label}</span>
            <span className="block text-xs text-muted-foreground">{sub}</span>
          </button>
        ))}
      </div>

      {tab === "freelancer" ? (
        <OnboardingForm defaults={defaults} maxBirthDate={maxBirthDate} />
      ) : (
        <CompanyOnboardingForm />
      )}
    </div>
  );
}
