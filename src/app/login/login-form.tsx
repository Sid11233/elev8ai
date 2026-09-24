"use client";

import { useActionState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { type MagicLinkState, sendMagicLink, signInWithGoogle } from "./actions";

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState<MagicLinkState, FormData>(sendMagicLink, {
    status: "idle",
  });

  if (state.status === "sent") {
    return (
      <div className="space-y-2 text-center">
        <p className="font-medium">Check your email</p>
        <p className="text-sm text-muted-foreground">
          We sent a login link to <span className="font-medium text-foreground">{state.email}</span>
          . Open it on this device to continue.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <form action={signInWithGoogle}>
        <input type="hidden" name="next" value={next ?? ""} />
        <Button type="submit" variant="outline" className="h-11 w-full">
          Continue with Google
        </Button>
      </form>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>

      <form action={formAction} className="space-y-3">
        <input type="hidden" name="next" value={next ?? ""} />
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="you@example.com"
            required
            defaultValue={state.status === "error" ? state.email : undefined}
            className="h-11"
          />
        </div>
        {state.status === "error" && (
          <Alert variant="destructive">
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        )}
        <Button type="submit" className="h-11 w-full" disabled={pending}>
          {pending ? "Sending…" : "Email me a login link"}
        </Button>
      </form>
    </div>
  );
}
