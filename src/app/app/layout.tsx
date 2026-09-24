import { Logo } from "@/components/brand/logo";
import { NotificationBell } from "@/components/notification-bell";
import { SignOutButton } from "@/components/sign-out-button";
import { TalentBottomNav, TalentSidebarNav } from "@/components/talent/talent-nav";
import { UserAvatar } from "@/components/user-avatar";
import { requireOnboardedProfile } from "@/lib/auth";

// Talent area: bottom navigation on phones, sidebar on desktop.
export default async function TalentLayout({ children }: LayoutProps<"/app">) {
  const profile = await requireOnboardedProfile();

  return (
    <div className="flex flex-1">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r bg-sidebar p-4 md:flex">
        <Logo href="/app/jobs" className="mb-8 px-3 pt-1" />
        <TalentSidebarNav />
        <div className="mt-auto flex items-center gap-3 border-t pt-4">
          <UserAvatar name={profile.full_name} src={profile.avatar_url} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{profile.full_name}</p>
            <p className="truncate text-xs text-muted-foreground">@{profile.username}</p>
          </div>
        </div>
        <div className="pt-3">
          <SignOutButton />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur md:px-8">
          <Logo href="/app/jobs" className="md:hidden" />
          <div className="ml-auto">
            <NotificationBell href="/app/notifications" />
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-28 md:px-8 md:pb-10">
          {children}
        </main>
      </div>

      <TalentBottomNav />
    </div>
  );
}
