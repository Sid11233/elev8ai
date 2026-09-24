import Link from "next/link";

import { AdminMobileNav, AdminNav } from "@/components/admin/admin-nav";
import { Logo } from "@/components/brand/logo";
import { SignOutButton } from "@/components/sign-out-button";
import { UserAvatar } from "@/components/user-avatar";
import { requireAdmin } from "@/lib/auth";

// Admin area: only admins get past requireAdmin(); everyone else is redirected.
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const profile = await requireAdmin();

  return (
    <div className="flex flex-1">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col overflow-y-auto border-r bg-sidebar p-4 md:flex">
        <div className="mb-6 flex items-baseline gap-2 px-3 pt-1">
          <Logo href="/admin" />
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Admin
          </span>
        </div>
        <AdminNav />
        <div className="mt-auto space-y-3 border-t pt-4">
          <div className="flex items-center gap-3">
            <UserAvatar name={profile.full_name} src={profile.avatar_url} />
            <p className="min-w-0 flex-1 truncate text-sm font-medium">{profile.full_name}</p>
          </div>
          <div className="flex items-center justify-between gap-2">
            <Link href="/app/jobs" className="text-xs text-muted-foreground hover:text-foreground">
              Talent view
            </Link>
            <SignOutButton />
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/85 px-4 backdrop-blur md:hidden">
          <AdminMobileNav />
          <Logo href="/admin" />
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Admin
          </span>
          <div className="ml-auto">
            <SignOutButton />
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-8 md:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
