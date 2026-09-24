import { SignOutButton } from "@/components/sign-out-button";
import { requireOnboardedProfile } from "@/lib/auth";

// Talent area. Placeholder shell; the full navigation arrives in Phase 1c.
export default async function TalentLayout({ children }: LayoutProps<"/app">) {
  const profile = await requireOnboardedProfile();

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <span className="font-semibold">Elev8ai</span>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">@{profile.username}</span>
          <SignOutButton />
        </div>
      </header>
      <main className="flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
