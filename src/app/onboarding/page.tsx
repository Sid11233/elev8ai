import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentProfile, homePathFor, requireUser } from "@/lib/auth";
import { MIN_AGE } from "@/lib/validation/profile";

import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = { title: "Set up your profile · Elev8ai" };

export default async function OnboardingPage() {
  await requireUser();
  const profile = await getCurrentProfile();
  if (profile?.onboarded) redirect(homePathFor(profile));

  const maxBirthDate = new Date();
  maxBirthDate.setFullYear(maxBirthDate.getFullYear() - MIN_AGE);

  return (
    <main className="flex flex-1 justify-center px-4 py-8 sm:py-12">
      <Card className="h-fit w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Set up your profile</CardTitle>
          <CardDescription>This is what companies see when you apply for jobs.</CardDescription>
        </CardHeader>
        <CardContent>
          <OnboardingForm
            defaults={{ full_name: profile?.full_name, country: profile?.country }}
            maxBirthDate={maxBirthDate.toISOString().slice(0, 10)}
          />
        </CardContent>
      </Card>
    </main>
  );
}
