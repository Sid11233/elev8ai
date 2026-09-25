import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { getCurrentProfile, homePathFor } from "@/lib/auth";

// Public marketing chrome: header + footer around the landing and legal pages.
export default async function MarketingLayout({ children }: LayoutProps<"/">) {
  const profile = await getCurrentProfile();
  const appHref = profile ? homePathFor(profile) : null;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-6">
          <Logo href="/" />
          {appHref ? (
            <Button asChild size="sm" className="h-9">
              <Link href={appHref}>Go to app</Link>
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button asChild variant="ghost" size="sm" className="h-9">
                <Link href="/login">Log in</Link>
              </Button>
              <Button asChild size="sm" className="h-9">
                <Link href="/login">Get started</Link>
              </Button>
            </div>
          )}
        </div>
      </header>

      <div className="flex-1">{children}</div>

      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-6 py-8 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground">
            © {new Date().getFullYear()} Elev8ai. Get paid for real work.
          </p>
          <nav className="flex flex-wrap gap-4">
            <Link href="/terms" className="text-muted-foreground hover:text-foreground">
              Terms
            </Link>
            <Link href="/privacy" className="text-muted-foreground hover:text-foreground">
              Privacy
            </Link>
            <Link
              href="/contractor-agreement"
              className="text-muted-foreground hover:text-foreground"
            >
              Contractor Agreement
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
