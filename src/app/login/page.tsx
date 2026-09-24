import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentProfile, homePathFor, safeNextPath } from "@/lib/auth";

import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Log in · Elev8ai" };

const ERRORS: Record<string, string> = {
  google: "Google sign-in isn't available right now. Try the email link instead.",
  link: "That login link is invalid or has expired. Request a new one below.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = safeNextPath(typeof params.next === "string" ? params.next : null) ?? undefined;
  const error = typeof params.error === "string" ? ERRORS[params.error] : undefined;

  const profile = await getCurrentProfile();
  if (profile) redirect(profile.onboarded && next ? next : homePathFor(profile));

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Welcome to Elev8ai</CardTitle>
          <CardDescription>Log in or create your account</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <LoginForm next={next} />
          <p className="text-center text-xs text-muted-foreground">
            You must be 18 or older to join.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
